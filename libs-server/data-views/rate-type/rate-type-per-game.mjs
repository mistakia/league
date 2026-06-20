import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { decompose_nfl_weeks } from '#libs-shared/nfl-week-identifier.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import {
  apply_scope_to_query,
  compute_effective_scope
} from '#libs-server/data-views/apply-scope-to-query.mjs'
import db from '#db'
import {
  resolve_year_offset_range,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'
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
  query_context
}) => {
  const { career_year, career_game } = get_default_params({ params })

  // Effective view-level scope, narrowed by any per-column override.
  // years drives the single-year partition optimization and the
  // player_gamelogs.year predicate; the full nfl_week_id set drives the
  // nfl_games seas_type / nfl_week_id predicates via apply_scope_to_query.
  const effective_scope = compute_effective_scope({
    query_context,
    column_params: params
  })
  const { years } = decompose_nfl_weeks({ nfl_weeks: effective_scope })
  const sorted_years = [...years].sort((a, b) => a - b)
  const single_year = sorted_years.length === 1 ? sorted_years[0] : null
  const player_gamelogs_table = single_year
    ? `player_gamelogs_year_${single_year}`
    : 'player_gamelogs'

  let cte_query = db(player_gamelogs_table)
    .select(`${player_gamelogs_table}.pid`)
    .count('* as rate_type_total_count')
    .select(db.raw(`array_agg(distinct ${player_gamelogs_table}.tm) as teams`))
    .where(`${player_gamelogs_table}.active`, true)

  // nfl_games join is required whenever the view has scoped weeks (the common
  // case after view-scope unification) or career filters / splits are active.
  const needs_nfl_games =
    effective_scope.length > 0 ||
    career_year.length > 0 ||
    splits.includes('year') ||
    splits.includes('week')

  if (needs_nfl_games) {
    cte_query.leftJoin(
      'nfl_games',
      'nfl_games.esbid',
      `${player_gamelogs_table}.esbid`
    )
    apply_scope_to_query({
      query: cte_query,
      table_name: 'nfl_games',
      query_context,
      column_params: params
    })
  }

  if (sorted_years.length && !single_year) {
    cte_query.whereIn(`${player_gamelogs_table}.year`, sorted_years)
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
  query_context
}) => {
  // Count games per team from nfl_games (~7K rows for 24 years) instead of
  // COUNT(DISTINCT esbid) over nfl_plays (~1.3M rows for the same range).
  // Equivalent because every game appears as both home and away exactly once,
  // so UNION ALL of {home, away} → COUNT(*) per (team, year[, week]) yields
  // the same denominator as DISTINCT esbid per (off, year[, week]) on plays.
  // Measured: 5.8s → 2.3s on year-splits-with-a-column-set-to-a-specific-year.
  // Partition the denominator by year ONLY when a year split is active, matching
  // the established rate-CTE invariant (build-period-cte's `include_year` and the
  // player per-game denominator below). The join only correlates on year under a
  // year split (join_team_per_game_cte), so grouping by year unconditionally fans
  // the denominator into one row per (team, year); with no year split the outer
  // MAX() then collapses to a single season's game count while the numerator is a
  // full multi-year total -- inflating every team per-game rate by ~N (N = years
  // in the window). Keeping year conditional yields one row per team (full-window
  // game count) when unsplit, and a year-correlated 1:1 join when split.
  const select_cols = ['team']
  const group_cols = ['team']
  if (splits.includes('year')) {
    select_cols.push('year')
    group_cols.push('year')
  }
  if (splits.includes('week')) {
    select_cols.push('week')
    group_cols.push('week')
  }

  const make_side = (team_col) => {
    const sub = db('nfl_games').select(`${team_col} as team`)
    if (splits.includes('year')) sub.select('year')
    if (splits.includes('week')) sub.select('week')
    apply_scope_to_query({
      query: sub,
      table_name: 'nfl_games',
      query_context,
      column_params: params
    })
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
  query_context
}) => {
  if (is_team) {
    add_team_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      query_context
    })
  } else {
    add_player_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      query_context
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
  players_query.leftJoin(rate_type_table_name, function () {
    // Use centralized player PID reference
    this.on(`${rate_type_table_name}.pid`, data_view_options.pid_reference)

    if (splits.includes('year')) {
      const offset_range = resolve_year_offset_range(params)
      if (offset_range) {
        // Correlate the rate-type table year to the base-year anchor THROUGH
        // the offset via the shared primitive (single `= ref+k`, range
        // BETWEEN) -- replaces the inline has_year_offset_range /
        // has_single_year_offset reimplementation.
        emit_year_match({
          builder: this,
          db,
          year_reference: data_view_options.year_reference,
          source: {},
          key_columns: { year: 'year' },
          params,
          ref: rate_type_table_name
        })
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
      const offset_range = resolve_year_offset_range(params)
      if (offset_range) {
        // Correlate the rate-type table year to the base-year anchor THROUGH
        // the offset via the shared primitive (single `= ref+k`, range
        // BETWEEN) -- replaces the inline has_year_offset_range /
        // has_single_year_offset reimplementation.
        emit_year_match({
          builder: this,
          db,
          year_reference: data_view_options.year_reference,
          source: {},
          key_columns: { year: 'year' },
          params,
          ref: rate_type_table_name
        })
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
    query_context
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
