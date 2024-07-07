import { constants, stat_in_year_week } from '#libs-shared'

import db from '#db'
import get_table_hash from '#libs-server/get-table-hash.mjs'

const projections_index_table_alias = ({ params = {} }) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  return get_table_hash(`projections_index_${year}_week_${week}`)
}

const scoring_format_player_projection_points_table_alias = ({
  params = {}
}) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  const scoring_format_hash = params.scoring_format_hash || '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  return get_table_hash(
    `scoring_format_player_projection_points_${year}_week_${week}_${scoring_format_hash}`
  )
}

const league_player_projection_values_table_alias = ({ params = {} }) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  const league_id = params.league_id || 1
  return get_table_hash(
    `league_player_projection_values_${year}_week_${week}_league_${league_id}`
  )
}

// TODO splits
const league_player_projection_values_join = ({ query, params = {}, table_name }) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  const league_id = params.league_id || 1

  query.leftJoin(`league_player_projection_values as ${table_name}`, function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
    this.andOn(`${table_name}.year`, '=', db.raw('?', [year]))
    this.andOn(`${table_name}.week`, '=', db.raw('?', [week]))
    this.andOn(`${table_name}.lid`, '=', db.raw('?', [league_id]))
  })
}

const league_format_player_projection_values_table_alias = ({
  params = {}
}) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  const league_format_hash = params.league_format_hash || '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  return get_table_hash(
    `league_format_player_projection_values_${year}_week_${week}_${league_format_hash}`
  )
}

// TODO splits
const scoring_format_player_projection_points_join = ({ query, params = {}, table_name }) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  const scoring_format_hash = params.scoring_format_hash || '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'

  query.leftJoin(`scoring_format_player_projection_points as ${table_name}`, function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
    this.andOn(`${table_name}.year`, '=', db.raw('?', [year]))
    this.andOn(`${table_name}.week`, '=', db.raw('?', [week.toString()]))
    this.andOn(`${table_name}.scoring_format_hash`, '=', db.raw('?', [scoring_format_hash]))
  })
}

// TODO splits
const league_format_player_projection_values_join = ({ query, params = {}, table_name }) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  const league_format_hash = params.league_format_hash || '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'

  query.leftJoin(`league_format_player_projection_values as ${table_name}`, function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
    this.andOn(`${table_name}.year`, '=', db.raw('?', [year]))
    this.andOn(`${table_name}.week`, '=', db.raw('?', [week.toString()]))
    this.andOn(`${table_name}.league_format_hash`, '=', db.raw('?', [league_format_hash]))
  })
}

// TODO splits
const projections_index_join = ({ query, params = {}, table_name }) => {
  const year = Array.isArray(params.year) ? params.year[0] : (params.year || constants.season.year)
  const week = Array.isArray(params.week) ? params.week[0] : (params.week || 0)
  query.leftJoin(`projections_index as ${table_name}`, function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
    this.andOn(`${table_name}.year`, '=', db.raw('?', [year]))
    this.andOn(`${table_name}.week`, '=', db.raw('?', [week]))
    this.andOn(`${table_name}.sourceid`, '=', constants.sources.AVERAGE)
  })
}

const player_projected_points_added = {
  column_name: 'pts_added',
  table_name: 'league_format_player_projection_values',
  table_alias: league_format_player_projection_values_table_alias,
  select_as: stat_in_year_week('points_added'),
  join: league_format_player_projection_values_join
}

const player_projected_market_salary = {
  column_name: 'market_salary',
  table_name: 'league_format_player_projection_values',
  table_alias: league_format_player_projection_values_table_alias,
  select_as: stat_in_year_week('market_salary'),
  join: league_format_player_projection_values_join
}

const player_projected_salary_adjusted_points_added = {
  column_name: 'salary_adj_pts_added',
  table_name: 'league_player_projection_values',
  table_alias: league_player_projection_values_table_alias,
  select_as: stat_in_year_week('salary_adjusted_points_added'),
  join: league_player_projection_values_join
}

const player_projected_points = {
  column_name: 'total',
  table_name: 'scoring_format_player_projection_points',
  table_alias: scoring_format_player_projection_points_table_alias,
  select_as: stat_in_year_week('proj_fan_pts'),
  join: scoring_format_player_projection_points_join
}

const player_projected_pass_atts = {
  column_name: 'pa',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_pass_atts'),
  join: projections_index_join
}

const player_projected_pass_comps = {
  column_name: 'pc',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_pass_comps'),
  join: projections_index_join
}

const player_projected_pass_yds = {
  column_name: 'py',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_pass_yds'),
  join: projections_index_join
}

const player_projected_pass_tds = {
  column_name: 'tdp',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_pass_tds'),
  join: projections_index_join
}

const player_projected_pass_ints = {
  column_name: 'ints',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_pass_ints'),
  join: projections_index_join
}

const player_projected_rush_atts = {
  column_name: 'ra',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_rush_atts'),
  join: projections_index_join
}

const player_projected_rush_yds = {
  column_name: 'ry',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_rush_yds'),
  join: projections_index_join
}

const player_projected_rush_tds = {
  column_name: 'tdr',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_rush_tds'),
  join: projections_index_join
}

const player_projected_fumbles_lost = {
  column_name: 'fuml',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_fumbles_lost'),
  join: projections_index_join
}

const player_projected_targets = {
  column_name: 'trg',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_trg'),
  join: projections_index_join
}

const player_projected_recs = {
  column_name: 'rec',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_rec'),
  join: projections_index_join
}

const player_projected_rec_yds = {
  column_name: 'recy',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_rec_yds'),
  join: projections_index_join
}

const player_projected_rec_tds = {
  column_name: 'tdrec',
  table_name: 'projections_index',
  table_alias: projections_index_table_alias,
  select_as: stat_in_year_week('proj_rec_tds'),
  join: projections_index_join
}

const create_projected_stat = (base_object, stat_name) => {
  const prefixes = ['week', 'season', 'rest_of_season']
  return prefixes.reduce((acc, prefix) => {
    acc[`player_${prefix}_projected_${stat_name}`] = base_object
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
    select_as: stat_in_year_week('inflation_adjusted_market_salary'),
    join: league_player_projection_values_join
  },

  player_week_projected_market_salary: player_projected_market_salary,
  player_season_projected_market_salary: player_projected_market_salary,
  player_rest_of_season_projected_market_salary: player_projected_market_salary,

  ...projected_stat_column_defintions
}
