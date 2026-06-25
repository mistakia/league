import { DEFAULT_LEAGUE_FORMAT_ID } from '#libs-shared'
import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import {
  create_exact_year_cache_info,
  create_static_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'
import { get_league_format_id } from '#libs-server/data-views/index.mjs'

// TODO career_year

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || current_season.stats_season_year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_cache_info_for_league_format_seasonlogs =
  create_exact_year_cache_info({
    get_year: (params) => get_default_params({ params }).year
  })

const get_cache_info_for_league_format_careerlogs = create_static_cache_info({
  ttl: CACHE_TTL.SIX_HOURS
})

const league_format_player_seasonlogs_table_alias = ({ params = {} }) => {
  const { league_format_id = DEFAULT_LEAGUE_FORMAT_ID } = params
  let year = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let year_offset_single = params.year_offset || 0
  if (Array.isArray(year_offset_single)) {
    year_offset_single = year_offset_single[0]
  }

  return get_table_hash(
    `league_format_player_seasonlogs_${year.join('_')}_${league_format_id}_year_offset_${year_offset_single}`
  )
}

const league_format_seasonlogs_year_default = (params) => {
  let year = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }
  return year
}

const league_format_player_seasonlogs_source = {
  table: 'league_format_player_seasonlogs',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'year' },
  year_default: league_format_seasonlogs_year_default,
  extra_predicates: (params) => [
    { column: 'league_format_id', value: get_league_format_id(params) }
  ]
}

const league_format_seasonlogs_conditions = ({ params, row_axes = [] }) => {
  const conditions = [
    { column: 'league_format_id', value: get_league_format_id(params) }
  ]

  // Add year filter when no year splits are active
  if (!row_axes.includes('year') && params.year) {
    const year = Array.isArray(params.year) ? params.year[0] : params.year
    if (year !== undefined && year !== null) {
      conditions.push({ column: 'year', value: year })
    }
  }

  return conditions
}

// Range year_offset reduction per column (select-string's correlated-aggregate
// path defaults to SUM). Counting/accumulating season fields are additive (SUM
// default): startable_games, earned_salary, points_added_earned,
// points_added_net. Per-game averages and season/position ranks are not -- a
// multi-year window must AVG them rather than sum them. Careerlog fields are
// single-row-per-player and carry no year dimension, so year_offset never
// produces a multi-row window for them -- they keep the SUM default untouched.
const LEAGUE_FORMAT_SEASONLOGS_RANGE_OFFSET_AGGREGATE = {
  points_added_earned_per_game: 'AVG',
  points_added_earned_rank: 'AVG',
  points_added_earned_position_rank: 'AVG',
  points_added_earned_per_game_rank: 'AVG',
  points_added_earned_per_game_position_rank: 'AVG',
  points_added_net_per_game: 'AVG'
}

const create_field_from_league_format_player_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_seasonlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: league_format_player_seasonlogs_table_alias,
  source: league_format_player_seasonlogs_source,
  range_offset_aggregate:
    LEAGUE_FORMAT_SEASONLOGS_RANGE_OFFSET_AGGREGATE[column_name],
  get_cache_info: get_cache_info_for_league_format_seasonlogs,
  get_table_conditions: league_format_seasonlogs_conditions
})

const league_format_player_careerlogs_table_alias = ({ params = {} }) => {
  const { league_format_id = DEFAULT_LEAGUE_FORMAT_ID } = params
  return get_table_hash(`league_format_player_careerlogs_${league_format_id}`)
}

const league_format_player_careerlogs_source = {
  table: 'league_format_player_careerlogs',
  grain: 'player',
  key_columns: { pid: 'pid' },
  extra_predicates: (params) => [
    { column: 'league_format_id', value: get_league_format_id(params) }
  ]
}

const create_field_from_league_format_player_careerlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_careerlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: league_format_player_careerlogs_table_alias,
  source: league_format_player_careerlogs_source,
  get_cache_info: get_cache_info_for_league_format_careerlogs
})

export default {
  player_startable_games_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('startable_games'),
  player_earned_salary_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('earned_salary'),
  player_points_added_earned_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('points_added_earned'),
  player_points_added_earned_per_game_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs(
      'points_added_earned_per_game'
    ),
  player_points_added_earned_rank_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs(
      'points_added_earned_rank'
    ),
  player_points_added_earned_position_rank_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs(
      'points_added_earned_position_rank'
    ),
  player_points_added_earned_per_game_rank_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs(
      'points_added_earned_per_game_rank'
    ),
  player_points_added_earned_per_game_position_rank_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs(
      'points_added_earned_per_game_position_rank'
    ),
  player_points_added_net_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('points_added_net'),
  player_points_added_net_per_game_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs(
      'points_added_net_per_game'
    ),

  player_startable_games_from_careerlogs:
    create_field_from_league_format_player_careerlogs('startable_games'),
  player_points_added_earned_from_careerlogs:
    create_field_from_league_format_player_careerlogs('points_added_earned'),
  player_points_added_earned_per_game_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_per_game'
    ),
  player_best_season_points_added_earned_per_game_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'best_season_points_added_earned_per_game'
    ),
  player_best_season_earned_salary_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'best_season_earned_salary'
    ),
  player_points_added_earned_first_three_seasons_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_first_three_seasons'
    ),
  player_points_added_earned_first_four_seasons_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_first_four_seasons'
    ),
  player_points_added_earned_first_five_seasons_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_first_five_seasons'
    ),
  player_points_added_earned_first_season_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_first_season'
    ),
  player_points_added_earned_second_season_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_second_season'
    ),
  player_points_added_earned_third_season_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_earned_third_season'
    ),
  player_points_added_net_from_careerlogs:
    create_field_from_league_format_player_careerlogs('points_added_net'),
  player_points_added_net_per_game_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_net_per_game'
    ),
  player_draft_rank_from_careerlogs:
    create_field_from_league_format_player_careerlogs('draft_rank')
}
