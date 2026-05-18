import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import {
  decompose_nfl_weeks,
  is_full_year_seas_type_coverage
} from '#libs-shared/nfl-week-identifier.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import db from '#db'
import { emit_rate_outer_select } from './emit-rate-outer-select.mjs'
import { is_team_identity } from '#libs-server/data-views/identities.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const nfl_week = resolve_nfl_week_id_from_year_param(params)

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
  }

  // Derive all_years from nfl_week (post-offset expanded set)
  const { years: all_years } = nfl_week.length
    ? decompose_nfl_weeks({ nfl_weeks: nfl_week })
    : { years: [] }

  return {
    nfl_week,
    career_year,
    career_game,
    all_years
  }
}

export const get_per_game_cte_table_name = ({
  params = {},
  is_team = false
} = {}) => {
  const { nfl_week, career_year, career_game } = get_default_params({
    params
  })

  const prefix = is_team ? 'team' : 'player'

  const matchup_opponent_type = params.matchup_opponent_type || null
  const matchup_opponent_suffix = matchup_opponent_type
    ? `_${matchup_opponent_type}`
    : ''

  return get_table_hash(
    `${prefix}_games_played${matchup_opponent_suffix}_nfl_week_${nfl_week.join('_')}_career_year_${career_year.join('_')}_career_game_${career_game.join('_')}`
  )
}

const add_player_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = [],
  effective_years
}) => {
  const { nfl_week, career_year, career_game } = get_default_params({
    params
  })

  // Use year-specific player_gamelogs table if a single year is specified
  const single_year =
    effective_years && effective_years.length === 1 ? effective_years[0] : null
  const player_gamelogs_table = single_year
    ? `player_gamelogs_year_${single_year}`
    : 'player_gamelogs'

  let cte_query = db(player_gamelogs_table)
    .select(`${player_gamelogs_table}.pid`)
    .count('* as rate_type_total_count')
    .select(db.raw(`array_agg(distinct ${player_gamelogs_table}.tm) as teams`))
    .where(`${player_gamelogs_table}.active`, true)

  // Only join nfl_games when its columns are actually needed
  const needs_nfl_games =
    nfl_week.length > 0 ||
    career_year.length > 0 ||
    splits.includes('year') ||
    splits.includes('week')

  if (needs_nfl_games) {
    cte_query.leftJoin(
      'nfl_games',
      'nfl_games.esbid',
      `${player_gamelogs_table}.esbid`
    )
  }

  if (nfl_week.length) {
    const { seas_types } = decompose_nfl_weeks({ nfl_weeks: nfl_week })
    if (!is_full_year_seas_type_coverage({ nfl_weeks: nfl_week })) {
      cte_query.whereIn('nfl_games.nfl_week_id', nfl_week)
    }
    if (seas_types.length) {
      cte_query.whereIn('nfl_games.seas_type', seas_types)
    }
  }

  if (effective_years.length) {
    if (!single_year) {
      cte_query.whereIn(`${player_gamelogs_table}.year`, effective_years)
    }
    if (needs_nfl_games) {
      cte_query.whereIn('nfl_games.year', effective_years)
    }
  }

  if (career_year.length) {
    cte_query = cte_query.leftJoin('player_seasonlogs', function () {
      this.on('player_seasonlogs.pid', `${player_gamelogs_table}.pid`)
      this.andOn('player_seasonlogs.year', 'nfl_games.year')
      this.andOn('player_seasonlogs.seas_type', 'nfl_games.seas_type')
    })
  }

  if (career_year.length === 2) {
    const min_career_year = Math.min(...career_year.map(Number))
    const max_career_year = Math.max(...career_year.map(Number))
    cte_query.whereBetween('player_seasonlogs.career_year', [
      min_career_year,
      max_career_year
    ])
  }

  if (career_game.length === 2) {
    const min_career_game = Math.min(...career_game.map(Number))
    const max_career_game = Math.max(...career_game.map(Number))
    cte_query.whereBetween(`${player_gamelogs_table}.career_game`, [
      min_career_game,
      max_career_game
    ])
  }

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_games.year')
      cte_query.groupBy('nfl_games.year')
    }

    if (split === 'week') {
      cte_query.select('nfl_games.week')
      cte_query.groupBy('nfl_games.week')
    }
  }

  cte_query.groupBy(`${player_gamelogs_table}.pid`)

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on.
  players_query.withMaterialized(rate_type_table_name, cte_query)
}

const add_team_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = [],
  effective_years
}) => {
  const { nfl_week } = get_default_params({ params })

  // Count games per team from nfl_games (~7K rows for 24 years) instead of
  // COUNT(DISTINCT esbid) over nfl_plays (~1.3M rows for the same range).
  // Equivalent because every game appears as both home and away exactly once,
  // so UNION ALL of {home, away} → COUNT(*) per (team, year[, week]) yields
  // the same denominator as DISTINCT esbid per (off, year[, week]) on plays.
  // Measured: 5.8s → 2.3s on year-splits-with-a-column-set-to-a-specific-year.
  const select_cols = ['team', 'year']
  const group_cols = ['team', 'year']
  if (splits.includes('week')) {
    select_cols.push('week')
    group_cols.push('week')
  }

  const { seas_types } = nfl_week.length
    ? decompose_nfl_weeks({ nfl_weeks: nfl_week })
    : { seas_types: [] }
  const covers_full_year_seas_type =
    nfl_week.length &&
    is_full_year_seas_type_coverage({ nfl_weeks: nfl_week })

  const make_side = (team_col) => {
    const sub = db('nfl_games').select(`${team_col} as team`, 'year')
    if (splits.includes('week')) sub.select('week')
    if (nfl_week.length && !covers_full_year_seas_type) {
      sub.whereIn('nfl_games.nfl_week_id', nfl_week)
    }
    if (seas_types.length) {
      sub.whereIn('nfl_games.seas_type', seas_types)
    }
    if (effective_years.length) {
      sub.whereIn('nfl_games.year', effective_years)
    }
    return sub
  }

  const home_side = make_side('h')
  const away_side = make_side('v')
  const cte_query = db
    .select(...select_cols)
    .count('* as rate_type_total_count')
    .from(home_side.unionAll(away_side, true).as('g'))
    .groupBy(...group_cols)

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on.
  players_query.withMaterialized(rate_type_table_name, cte_query)
}

export const add_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = [],
  is_team = false,
  data_view_options = {}
}) => {
  const { all_years } = get_default_params({ params })
  const effective_years =
    data_view_options.year_range && data_view_options.year_range.length
      ? [...new Set([...data_view_options.year_range, ...all_years])].sort(
          (a, b) => a - b
        )
      : all_years

  if (is_team) {
    add_team_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      effective_years
    })
  } else {
    add_player_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      effective_years
    })
  }
}

export const join_player_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  params,
  is_team = false,
  data_view_options = {}
}) => {
  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) &&
      (year_offset.length === 1 || year_offset[0] === year_offset[1])) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    // Use centralized player PID reference
    this.on(`${rate_type_table_name}.pid`, data_view_options.pid_reference)

    if (splits.includes('year')) {
      if (has_year_offset_range) {
        const min_offset = Math.min(year_offset[0], year_offset[1])
        const max_offset = Math.max(year_offset[0], year_offset[1])
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN ${data_view_options.year_reference} + ? AND ${data_view_options.year_reference} + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(
            `${rate_type_table_name}.year = ${data_view_options.year_reference} + ?`,
            [offset]
          )
        )
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(
            `${rate_type_table_name}.year`,
            '=',
            db.raw('?', [specific_year])
          )
        } else {
          this.on(
            `${rate_type_table_name}.year`,
            data_view_options.year_reference
          )
        }
      }
    }

    // Add week join condition if 'week' split is enabled - use centralized reference
    if (splits.includes('week')) {
      this.andOn(
        `${rate_type_table_name}.week`,
        '=',
        data_view_options.week_reference
      )
    }
  })
}

export const join_team_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  params,
  data_view_options = {}
}) => {
  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) &&
      (year_offset.length === 1 || year_offset[0] === year_offset[1])) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
      ? params.matchup_opponent_type[0] &&
        typeof params.matchup_opponent_type[0] === 'object'
        ? null
        : params.matchup_opponent_type[0]
      : params.matchup_opponent_type

    if (matchup_opponent_type) {
      switch (matchup_opponent_type) {
        case 'current_week_opponent_total':
          this.on(
            `${rate_type_table_name}.team`,
            'current_week_opponents.opponent'
          )
          break
        case 'next_week_opponent_total':
          this.on(
            `${rate_type_table_name}.team`,
            'next_week_opponents.opponent'
          )
          break
        default:
          console.log(`Unknown matchup_opponent_type: ${matchup_opponent_type}`)
          break
      }
    } else {
      this.on(`${rate_type_table_name}.team`, 'player.current_nfl_team')
    }

    if (splits.includes('year')) {
      if (has_year_offset_range) {
        const min_offset = Math.min(year_offset[0], year_offset[1])
        const max_offset = Math.max(year_offset[0], year_offset[1])
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN ${data_view_options.year_reference} + ? AND ${data_view_options.year_reference} + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(
            `${rate_type_table_name}.year = ${data_view_options.year_reference} + ?`,
            [offset]
          )
        )
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(
            `${rate_type_table_name}.year`,
            '=',
            db.raw('?', [specific_year])
          )
        } else {
          this.on(
            `${rate_type_table_name}.year`,
            data_view_options.year_reference
          )
        }
      }
    }

    // Add week join condition if 'week' split is enabled - use centralized reference
    if (splits.includes('week')) {
      this.andOn(
        `${rate_type_table_name}.week`,
        '=',
        data_view_options.week_reference
      )
    }
  })
}

export const join_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  params,
  is_team = false,
  data_view_options = {}
}) => {
  if (is_team) {
    join_team_per_game_cte({
      players_query,
      rate_type_table_name,
      splits,
      params,
      data_view_options
    })
  } else {
    join_player_per_game_cte({
      players_query,
      rate_type_table_name,
      splits,
      params,
      data_view_options
    })
  }
}

// ---- output-aggregator plugin interface (identity-driven) -----------------

export const consumes_params = [
  'year',
  'nfl_week_id',
  'seas_type',
  'year_offset',
  'career_year',
  'career_game',
  'matchup_opponent_type',
  'output_column_params',
  'rate_type_column_params'
]

export const get_cte_name = ({ params, identity_id }) => {
  const is_team = is_team_identity(identity_id)
  return get_per_game_cte_table_name({ params, is_team })
}

export const add_cte = ({ query_context, params, cte_name, identity_id }) => {
  if (query_context.applied_output_ctes.has(cte_name)) return
  const is_team = is_team_identity(identity_id)
  add_per_game_cte({
    players_query: query_context.players_query,
    params,
    rate_type_table_name: cte_name,
    splits: query_context.splits,
    is_team,
    data_view_options: { year_range: query_context.year_range }
  })
  query_context.applied_output_ctes.add(cte_name)
}

export const join_cte = ({ query_context, cte_name, identity_id, params }) => {
  const is_team = is_team_identity(identity_id)
  join_per_game_cte({
    players_query: query_context.players_query,
    rate_type_table_name: cte_name,
    splits: query_context.splits,
    params: params ?? query_context.params,
    is_team,
    data_view_options: query_context.data_view_options
  })
}

export const emit_outer_select = emit_rate_outer_select

export default {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
}
