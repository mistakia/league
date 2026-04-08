import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { decompose_nfl_weeks } from '#libs-shared/nfl-week-identifier.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import db from '#db'

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
    cte_query.whereIn('nfl_games.nfl_week_id', nfl_week)
    if (effective_years.length) {
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

  players_query.with(rate_type_table_name, cte_query)
}

const add_team_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = [],
  effective_years
}) => {
  const { nfl_week } = get_default_params({ params })

  const cte_query = db('nfl_plays')
    .select('nfl_plays.off as team')
    .countDistinct('nfl_plays.esbid as rate_type_total_count')

  if (nfl_week.length) {
    cte_query.whereIn('nfl_plays.nfl_week_id', nfl_week)
    // Partition pruning for year-partitioned nfl_plays
    if (effective_years.length) {
      cte_query.whereIn('nfl_plays.year', effective_years)
    }
  }

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_plays.year')
    }

    if (split === 'week') {
      cte_query.select('nfl_plays.week')
    }
  }

  cte_query.groupBy('nfl_plays.off')

  if (splits.includes('year')) {
    cte_query.groupBy('nfl_plays.year')
  }

  if (splits.includes('week')) {
    cte_query.groupBy('nfl_plays.week')
  }

  players_query.with(rate_type_table_name, cte_query)
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
