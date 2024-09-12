import db from '#db'
import { constants } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'

// TODO career_year

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || constants.season.stats_season_year
  if (Array.isArray(year)) {
    year = year[0]
  }
  return { year: Number(year) }
}

const get_cache_info_for_scoring_format_seasonlogs = ({ params = {} } = {}) => {
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

const get_cache_info_for_scoring_format_careerlogs = () => {
  return {
    cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
    // TODO should expire before the next game starts
    cache_expire_at: null
  }
}

const scoring_format_player_seasonlogs_table_alias = ({ params = {} }) => {
  let scoring_format_hash =
    params.scoring_format_hash ||
    '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  if (Array.isArray(scoring_format_hash)) {
    scoring_format_hash = scoring_format_hash[0]
  }

  let year = params.year || [constants.season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  if (!year.length) {
    year = [constants.season.stats_season_year]
  }

  let year_offset_single = params.year_offset || 0
  if (Array.isArray(year_offset_single)) {
    year_offset_single = year_offset_single[0]
  }

  return get_table_hash(
    `scoring_format_player_seasonlogs_${year.join('_')}_${scoring_format_hash}_year_offset_${year_offset_single}`
  )
}

const scoring_format_player_seasonlogs_join = (join_arguments) => {
  data_view_join_function({
    ...join_arguments,
    join_year: true,
    default_year: constants.season.stats_season_year,
    join_table_clause: `scoring_format_player_seasonlogs as ${join_arguments.table_name}`,
    additional_conditions: function ({ params, table_name }) {
      let scoring_format_hash =
        params.scoring_format_hash ||
        '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
      if (Array.isArray(scoring_format_hash)) {
        scoring_format_hash = scoring_format_hash[0]
      }

      this.andOn(
        db.raw(`${table_name}.scoring_format_hash = ?`, [scoring_format_hash])
      )
    }
  })
}

const scoring_format_player_careerlogs_table_alias = ({ params = {} }) => {
  let scoring_format_hash =
    params.scoring_format_hash ||
    '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  if (Array.isArray(scoring_format_hash)) {
    scoring_format_hash = scoring_format_hash[0]
  }

  return get_table_hash(
    `scoring_format_player_careerlogs_${scoring_format_hash}`
  )
}

const scoring_format_player_careerlogs_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {}
}) => {
  const join_func = get_join_func(join_type)
  let scoring_format_hash =
    params.scoring_format_hash ||
    '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  if (Array.isArray(scoring_format_hash)) {
    scoring_format_hash = scoring_format_hash[0]
  }

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
    this.andOn(
      db.raw(`${table_name}.scoring_format_hash = '${scoring_format_hash}'`)
    )
  }

  query[join_func](
    `scoring_format_player_careerlogs as ${table_name}`,
    join_conditions
  )
}

const create_field_from_scoring_format_player_seasonlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_seasonlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_name: 'scoring_format_player_seasonlogs',
  table_alias: scoring_format_player_seasonlogs_table_alias,
  join: scoring_format_player_seasonlogs_join,
  supported_splits: ['year'],
  get_cache_info: get_cache_info_for_scoring_format_seasonlogs
})

const create_field_from_scoring_format_player_careerlogs = (column_name) => ({
  column_name,
  select_as: () => `${column_name}_from_careerlogs`,
  main_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_name: 'scoring_format_player_careerlogs',
  table_alias: scoring_format_player_careerlogs_table_alias,
  join: scoring_format_player_careerlogs_join,
  get_cache_info: get_cache_info_for_scoring_format_careerlogs
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
