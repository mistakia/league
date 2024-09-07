import db from '#db'
import { constants } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'

// TODO career_year

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || constants.season.year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_cache_info_for_league_format_seasonlogs = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  if (year === constants.season.year) {
    return {
      cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
      // TODO should expire before the next game starts
      cache_expire_at: null
    }
  } else {
    return {
      cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
      cache_expire_at: null
    }
  }
}

const get_cache_info_for_league_format_careerlogs = () => {
  return {
    cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
    // TODO should expire before the next game starts
    cache_expire_at: null
  }
}

const league_format_player_seasonlogs_table_alias = ({ params = {} }) => {
  const {
    league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  } = params
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
    const {
      league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
    } = params

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
  const {
    league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  } = params
  return get_table_hash(`league_format_player_careerlogs_${league_format_hash}`)
}

const league_format_player_careerlogs_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {}
}) => {
  const join_func = get_join_func(join_type)
  const {
    league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  } = params

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
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
