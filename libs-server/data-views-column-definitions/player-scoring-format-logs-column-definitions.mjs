import { DEFAULT_SCORING_FORMAT_ID } from '#libs-shared'
import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import {
  create_exact_year_cache_info,
  create_static_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'
import { get_scoring_format_id } from '#libs-server/data-views/index.mjs'

// TODO career_year

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || current_season.stats_season_year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_cache_info_for_scoring_format_seasonlogs =
  create_exact_year_cache_info({
    get_year: (params) => get_default_params({ params }).year
  })

const get_cache_info_for_scoring_format_careerlogs = create_static_cache_info({
  ttl: CACHE_TTL.SIX_HOURS
})

const scoring_format_player_seasonlogs_table_alias = ({ params = {} }) => {
  let scoring_format_id =
    params.scoring_format_id || DEFAULT_SCORING_FORMAT_ID
  if (Array.isArray(scoring_format_id)) {
    scoring_format_id = scoring_format_id[0]
  }

  let year = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  if (!year.length) {
    year = [current_season.stats_season_year]
  }

  let year_offset_single = params.year_offset || 0
  if (Array.isArray(year_offset_single)) {
    year_offset_single = year_offset_single[0]
  }

  return get_table_hash(
    `scoring_format_player_seasonlogs_${year.join('_')}_${scoring_format_id}_year_offset_${year_offset_single}`
  )
}

// get_table_conditions fires when scoring_format_player_seasonlogs is selected
// as the FROM table (from-table-optimization). source.extra_predicates below
// fires when the source is attached as a measure (source-attach dispatch).
// The two paths are mutually exclusive per source instance: FROM-table path
// emits WHERE on the from-table alias; measure path emits AND ON during the
// LEFT JOIN. The year predicate is handled symmetrically: WHERE here when
// FROM, AND ON via player-family-to-player-year emit_year_match when measure.
const scoring_format_seasonlogs_conditions = ({ params, splits = [] }) => {
  const conditions = [
    { column: 'scoring_format_id', value: get_scoring_format_id(params) }
  ]

  if (!splits.includes('year') && params.year) {
    const year = Array.isArray(params.year) ? params.year[0] : params.year
    if (year !== undefined && year !== null) {
      conditions.push({ column: 'year', value: year })
    }
  }

  return conditions
}

const scoring_format_player_seasonlogs_source = {
  table: 'scoring_format_player_seasonlogs',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'year' },
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => [
    { column: 'scoring_format_id', value: get_scoring_format_id(params) }
  ]
}

const scoring_format_player_careerlogs_table_alias = ({ params = {} }) => {
  let scoring_format_id =
    params.scoring_format_id || DEFAULT_SCORING_FORMAT_ID
  if (Array.isArray(scoring_format_id)) {
    scoring_format_id = scoring_format_id[0]
  }

  return get_table_hash(
    `scoring_format_player_careerlogs_${scoring_format_id}`
  )
}

const scoring_format_player_careerlogs_source = {
  table: 'scoring_format_player_careerlogs',
  grain: 'player',
  key_columns: { pid: 'pid' },
  extra_predicates: (params) => [
    { column: 'scoring_format_id', value: get_scoring_format_id(params) }
  ]
}

const create_field_from_scoring_format_player_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_seasonlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: scoring_format_player_seasonlogs_table_alias,
  source: scoring_format_player_seasonlogs_source,
  get_cache_info: get_cache_info_for_scoring_format_seasonlogs,
  get_table_conditions: scoring_format_seasonlogs_conditions
})

const create_field_from_scoring_format_player_careerlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_careerlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: scoring_format_player_careerlogs_table_alias,
  source: scoring_format_player_careerlogs_source,
  get_cache_info: get_cache_info_for_scoring_format_careerlogs
  // careerlogs has no get_table_conditions; from-table-optimization is
  // ineligible regardless of granularity, so the field is omitted.
})

export default {
  player_fantasy_points_from_seasonlogs:
    create_field_from_scoring_format_player_seasonlogs('points'),
  player_fantasy_points_per_game_from_seasonlogs:
    create_field_from_scoring_format_player_seasonlogs('points_per_game'),
  player_fantasy_points_rank_from_seasonlogs:
    create_field_from_scoring_format_player_seasonlogs('points_rnk'),
  player_fantasy_points_position_rank_from_seasonlogs:
    create_field_from_scoring_format_player_seasonlogs('points_pos_rnk'),
  player_fantasy_points_per_game_rank_from_seasonlogs:
    create_field_from_scoring_format_player_seasonlogs('points_per_game_rnk'),
  player_fantasy_points_per_game_position_rank_from_seasonlogs:
    create_field_from_scoring_format_player_seasonlogs(
      'points_per_game_pos_rnk'
    ),

  player_fantasy_points_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('points'),
  player_fantasy_points_per_game_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('points_per_game'),
  player_fantasy_top_1_seasons_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('top_1'),
  player_fantasy_top_3_seasons_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('top_3'),
  player_fantasy_top_6_seasons_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('top_6'),
  player_fantasy_top_12_seasons_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('top_12'),
  player_fantasy_top_24_seasons_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('top_24'),
  player_fantasy_top_36_seasons_from_careerlogs:
    create_field_from_scoring_format_player_careerlogs('top_36')
}
