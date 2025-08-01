import db from '#db'
import { constants, DEFAULT_LEAGUE_FORMAT_HASH } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import {
  create_exact_year_cache_info,
  create_static_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'

// TODO career_year

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || constants.season.stats_season_year
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
  const { league_format_hash = DEFAULT_LEAGUE_FORMAT_HASH } = params
  let year = params.year || [constants.season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let year_offset_single = params.year_offset || 0
  if (Array.isArray(year_offset_single)) {
    year_offset_single = year_offset_single[0]
  }

  return get_table_hash(
    `league_format_player_seasonlogs_${year.join('_')}_${league_format_hash}_year_offset_${year_offset_single}`
  )
}

const league_format_player_seasonlogs_join = (join_arguments) => {
  const additional_conditions = function ({ params, table_name, splits }) {
    const { league_format_hash = DEFAULT_LEAGUE_FORMAT_HASH } = params

    let year = params.year || [constants.season.stats_season_year]
    if (!Array.isArray(year)) {
      year = [year]
    }

    this.andOn(
      db.raw(`${table_name}.league_format_hash = '${league_format_hash}'`)
    )

    if (!splits.includes('year')) {
      this.andOn(db.raw(`${table_name}.year IN (${year.join(',')})`))
    }
  }

  data_view_join_function({
    ...join_arguments,
    join_table_clause: `league_format_player_seasonlogs as ${join_arguments.table_name}`,
    additional_conditions
  })
}

const create_field_from_league_format_player_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_seasonlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_name: 'league_format_player_seasonlogs',
  table_alias: league_format_player_seasonlogs_table_alias,
  join: league_format_player_seasonlogs_join,
  supported_splits: ['year'],
  get_cache_info: get_cache_info_for_league_format_seasonlogs
})

const league_format_player_careerlogs_table_alias = ({ params = {} }) => {
  const { league_format_hash = DEFAULT_LEAGUE_FORMAT_HASH } = params
  return get_table_hash(`league_format_player_careerlogs_${league_format_hash}`)
}

const league_format_player_careerlogs_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  data_view_options = {}
}) => {
  const join_func = get_join_func(join_type)
  const { league_format_hash = DEFAULT_LEAGUE_FORMAT_HASH } = params

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
    this.andOn(
      db.raw(`${table_name}.league_format_hash = '${league_format_hash}'`)
    )
  }

  query[join_func](
    `league_format_player_careerlogs as ${table_name}`,
    join_conditions
  )
}

const create_field_from_league_format_player_careerlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_careerlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_name: 'league_format_player_careerlogs',
  table_alias: league_format_player_careerlogs_table_alias,
  join: league_format_player_careerlogs_join,
  get_cache_info: get_cache_info_for_league_format_careerlogs
})

export default {
  player_startable_games_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('startable_games'),
  player_earned_salary_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('earned_salary'),
  player_points_added_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('points_added'),
  player_points_added_per_game_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('points_added_per_game'),
  player_points_added_rank_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('points_added_rnk'),
  player_points_added_position_rank_from_seasonlogs:
    create_field_from_league_format_player_seasonlogs('points_added_pos_rnk'),

  player_startable_games_from_careerlogs:
    create_field_from_league_format_player_careerlogs('startable_games'),
  player_points_added_from_careerlogs:
    create_field_from_league_format_player_careerlogs('points_added'),
  player_points_added_per_game_from_careerlogs:
    create_field_from_league_format_player_careerlogs('points_added_per_game'),
  player_best_season_points_added_per_game_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'best_season_points_added_per_game'
    ),
  player_best_season_earned_salary_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'best_season_earned_salary'
    ),
  player_points_added_first_three_seasons_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_first_three_seas'
    ),
  player_points_added_first_four_seasons_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_first_four_seas'
    ),
  player_points_added_first_five_seasons_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_first_five_seas'
    ),
  player_points_added_first_season_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_first_seas'
    ),
  player_points_added_second_season_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_second_seas'
    ),
  player_points_added_third_season_from_careerlogs:
    create_field_from_league_format_player_careerlogs(
      'points_added_third_seas'
    ),
  player_draft_rank_from_careerlogs:
    create_field_from_league_format_player_careerlogs('draft_rank')
}
