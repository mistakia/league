import { constants } from '#libs-shared'

import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'

// TODO career_year

const get_default_params = ({ params = {} }) => {
  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || constants.season.year
  const week = Array.isArray(params.week) ? params.week[0] : params.week || 0
  const scoring_format_hash =
    params.scoring_format_hash ||
    '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  const league_format_hash =
    params.league_format_hash ||
    '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  const league_id = params.league_id || 1

  return { year, week, scoring_format_hash, league_format_hash, league_id }
}

const get_cache_info_for_player_projected_stats = ({ params = {} } = {}) => {
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

const projections_index_table_alias = ({ params = {} }) => {
  const { year, week } = get_default_params({ params })
  return get_table_hash(`projections_index_${year}_week_${week}`)
}

const scoring_format_player_projection_points_table_alias = ({
  params = {}
}) => {
  const { year, week, scoring_format_hash } = get_default_params({ params })
  return get_table_hash(
    `scoring_format_player_projection_points_${year}_week_${week}_${scoring_format_hash}`
  )
}

const league_player_projection_values_table_alias = ({ params = {} }) => {
  const { year, week, league_id } = get_default_params({ params })
  return get_table_hash(
    `league_player_projection_values_${year}_week_${week}_league_${league_id}`
  )
}

const league_format_player_projection_values_table_alias = ({
  params = {}
}) => {
  const { year, week, league_format_hash } = get_default_params({ params })
  return get_table_hash(
    `league_format_player_projection_values_${year}_week_${week}_${league_format_hash}`
  )
}

const league_player_projection_values_join = (join_arguments) => {
  const { params = {} } = join_arguments
  const { league_id } = get_default_params({ params })

  data_view_join_function({
    ...join_arguments,
    join_year: true,
    join_week: true,
    join_table_clause: `league_player_projection_values as ${join_arguments.table_name}`,
    additional_conditions: function () {
      this.andOn(
        `${join_arguments.table_name}.lid`,
        '=',
        db.raw('?', [league_id])
      )
    }
  })
}

const scoring_format_player_projection_points_join = (join_arguments) => {
  const { params = {} } = join_arguments
  const { scoring_format_hash } = get_default_params({ params })

  data_view_join_function({
    ...join_arguments,
    join_year: true,
    join_week: true,
    cast_join_week_to_string: true,
    join_table_clause: `scoring_format_player_projection_points as ${join_arguments.table_name}`,
    additional_conditions: function () {
      this.andOn(
        `${join_arguments.table_name}.scoring_format_hash`,
        '=',
        db.raw('?', [scoring_format_hash])
      )
    }
  })
}

const league_format_player_projection_values_join = (join_arguments) => {
  const { params = {} } = join_arguments
  const { league_format_hash } = get_default_params({ params })

  data_view_join_function({
    ...join_arguments,
    join_year: true,
    join_week: true,
    join_table_clause: `league_format_player_projection_values as ${join_arguments.table_name}`,
    additional_conditions: function () {
      this.andOn(
        `${join_arguments.table_name}.league_format_hash`,
        '=',
        db.raw('?', [league_format_hash])
      )
    }
  })
}

const projections_index_join = (join_arguments) => {
  data_view_join_function({
    ...join_arguments,
    join_year: true,
    join_week: true,
    join_table_clause: `projections_index as ${join_arguments.table_name}`,
    additional_conditions: function () {
      this.andOn(
        `${join_arguments.table_name}.sourceid`,
        '=',
        constants.sources.AVERAGE
      )
    }
  })
}

const player_projected_points_added = {
  column_name: 'pts_added',
  table_name: 'league_format_player_projection_values',
  table_alias: league_format_player_projection_values_table_alias,
  join: league_format_player_projection_values_join
}

const player_projected_market_salary = {
  column_name: 'market_salary',
  table_name: 'league_format_player_projection_values',
  table_alias: league_format_player_projection_values_table_alias,
  join: league_format_player_projection_values_join
}

const player_projected_salary_adjusted_points_added = {
  column_name: 'salary_adj_pts_added',
  table_name: 'league_player_projection_values',
  table_alias: league_player_projection_values_table_alias,
  join: league_player_projection_values_join
}

const player_projected_points = {
  column_name: 'total',
  table_name: 'scoring_format_player_projection_points',
  table_alias: scoring_format_player_projection_points_table_alias,
  join: scoring_format_player_projection_points_join
}

const player_projected_pass_atts = {
  column_name: 'pa',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_pass_comps = {
  column_name: 'pc',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_pass_yds = {
  column_name: 'py',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_pass_tds = {
  column_name: 'tdp',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_pass_ints = {
  column_name: 'ints',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_rush_atts = {
  column_name: 'ra',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_rush_yds = {
  column_name: 'ry',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_rush_tds = {
  column_name: 'tdr',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_fumbles_lost = {
  column_name: 'fuml',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_targets = {
  column_name: 'trg',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_recs = {
  column_name: 'rec',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_rec_yds = {
  column_name: 'recy',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const player_projected_rec_tds = {
  column_name: 'tdrec',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  join: projections_index_join
}

const create_projected_stat = (base_object, stat_name) => {
  const prefixes = ['week', 'season', 'rest_of_season']
  return prefixes.reduce((acc, prefix) => {
    acc[`player_${prefix}_projected_${stat_name}`] = {
      ...base_object,
      select_as: () => `${prefix}_projected_${stat_name}`,
      supported_splits: prefix === 'week' ? ['year', 'week'] : ['year'],
      get_cache_info: get_cache_info_for_player_projected_stats
    }
    return acc
  }, {})
}

const projected_stat_column_defintions = {
  ...create_projected_stat(player_projected_market_salary, 'market_salary'),
  ...create_projected_stat(
    player_projected_salary_adjusted_points_added,
    'salary_adjusted_points_added'
  ),
  ...create_projected_stat(player_projected_points_added, 'points_added'),
  ...create_projected_stat(player_projected_points, 'points'),
  ...create_projected_stat(player_projected_pass_atts, 'pass_atts'),
  ...create_projected_stat(player_projected_pass_comps, 'pass_comps'),
  ...create_projected_stat(player_projected_pass_yds, 'pass_yds'),
  ...create_projected_stat(player_projected_pass_tds, 'pass_tds'),
  ...create_projected_stat(player_projected_pass_ints, 'pass_ints'),
  ...create_projected_stat(player_projected_rush_atts, 'rush_atts'),
  ...create_projected_stat(player_projected_rush_yds, 'rush_yds'),
  ...create_projected_stat(player_projected_rush_tds, 'rush_tds'),
  ...create_projected_stat(player_projected_fumbles_lost, 'fumbles_lost'),
  ...create_projected_stat(player_projected_targets, 'targets'),
  ...create_projected_stat(player_projected_recs, 'recs'),
  ...create_projected_stat(player_projected_rec_yds, 'rec_yds'),
  ...create_projected_stat(player_projected_rec_tds, 'rec_tds')
}

export default {
  player_season_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_name: 'league_player_projection_values',
    table_alias: league_player_projection_values_table_alias,
    select_as: () => 'player_season_projected_inflation_adjusted_market_salary',
    join: league_player_projection_values_join,
    get_cache_info: get_cache_info_for_player_projected_stats
  },

  ...projected_stat_column_defintions
}
