import { constants } from '#libs-shared'
import db from '#db'

const projections_index_join = ({ query, params = {} }) => {
  const table_alias = projections_index_table_alias({ params })
  const { year = constants.season.year, week = 0 } = params
  query.leftJoin(`projections_index as ${table_alias}`, function () {
    this.on(`${table_alias}.pid`, '=', 'player.pid')
    this.andOn(`${table_alias}.year`, '=', year)
    this.andOn(`${table_alias}.week`, '=', week)
    this.andOn(`${table_alias}.sourceid`, '=', 0)
  })
}

const projections_index_table_alias = ({ params = {} }) => {
  const { year = constants.season.year, week = 0 } = params
  return `projections_index_${year}_week_${week}`
}

const projections_index_select =
  (stat_desc) =>
  ({ params = {} }) => {
    const { year = constants.season.year, week = 0 } = params
    return `proj_${stat_desc}_in_${year}_week_${week}`
  }

const league_format_player_projection_values_select =
  (stat_desc) =>
  ({ params = {} }) => {
    const { year = constants.season.year, week = 0 } = params
    return `${stat_desc}_in_${year}_week_${week}`
  }

const league_format_player_projection_values_join = ({
  query,
  params = {}
}) => {
  const {
    year = constants.season.year,
    week = 0,
    league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  } = params
  const table_alias = league_format_player_projection_values_table_alias({
    params
  })
  query.leftJoin(
    `league_format_player_projection_values as ${table_alias}`,
    function () {
      this.on(`${table_alias}.pid`, '=', 'player.pid')
      this.andOn(`${table_alias}.year`, '=', year)
      this.andOn(db.raw(`${table_alias}.week = '${week}'`))
      this.andOn(
        db.raw(`${table_alias}.league_format_hash = '${league_format_hash}'`)
      )
    }
  )
}

const league_format_player_projection_values_table_alias = ({
  params = {}
}) => {
  const {
    year = constants.season.year,
    week = 0,
    league_format_hash = '1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b'
  } = params
  return `league_format_player_projection_values_${year}_week_${week}_${league_format_hash}`
}

const scoring_format_player_projection_points_select =
  (stat_desc) =>
  ({ params = {} }) => {
    const { year = constants.season.year, week = 0 } = params
    return `${stat_desc}_in_${year}_week_${week}`
  }

const scoring_format_player_projection_points_join = ({
  query,
  params = {}
}) => {
  const {
    year = constants.season.year,
    week = 0,
    scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  } = params
  const table_alias = scoring_format_player_projection_points_table_alias({
    params
  })
  query.leftJoin(
    `scoring_format_player_projection_points as ${table_alias}`,
    function () {
      this.on(`${table_alias}.pid`, '=', 'player.pid')
      this.andOn(`${table_alias}.year`, '=', year)
      this.andOn(db.raw(`${table_alias}.week = '${week}'`))
      this.andOn(
        db.raw(`${table_alias}.scoring_format_hash = '${scoring_format_hash}'`)
      )
    }
  )
}

const scoring_format_player_projection_points_table_alias = ({
  params = {}
}) => {
  const {
    year = constants.season.year,
    week = 0,
    scoring_format_hash = '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
  } = params
  return `scoring_format_player_projection_points_${year}_week_${week}_${scoring_format_hash}`
}

const league_player_projection_values_select =
  (stat_desc) =>
  ({ params = {} }) => {
    const { year = constants.season.year, week = 0 } = params
    return `${stat_desc}_in_${year}_week_${week}`
  }

const league_player_projection_values_join = ({ query, params = {} }) => {
  const { year = constants.season.year, week = 0, league_id } = params
  const table_alias = league_player_projection_values_table_alias({ params })
  query.leftJoin(
    `league_player_projection_values as ${table_alias}`,
    function () {
      this.on(`${table_alias}.pid`, '=', 'player.pid')
      this.andOn(`${table_alias}.year`, '=', year)
      this.andOn(`${table_alias}.week`, '=', week)
      this.andOn(`${table_alias}.lid`, '=', league_id)
    }
  )
}

const league_player_projection_values_table_alias = ({ params = {} }) => {
  const { year = constants.season.year, week = 0, league_id } = params
  return `league_player_projection_values_${year}_week_${week}_${league_id}`
}

export default {
  player_name: {
    table_name: 'player',
    column_name: 'name'
  },
  player_league_roster_status: {},
  player_league_salary: {},

  player_week_projected_market_salary: {
    column_name: 'market_salary',
    table_name: 'league_format_player_projection_values',
    table_alias: league_format_player_projection_values_table_alias,
    select_as: league_format_player_projection_values_select('market_salary'),
    join: league_format_player_projection_values_join
  },
  player_week_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_name: 'league_player_projection_values',
    table_alias: league_player_projection_values_table_alias,
    select_as: league_player_projection_values_select(
      'inflation_adjusted_market_salary'
    ),
    join: league_player_projection_values_join
  },
  player_week_projected_salary_adjusted_points_added: {
    column_name: 'salary_adj_pts_added',
    table_name: 'league_player_projection_values',
    table_alias: league_player_projection_values_table_alias,
    select_as: league_player_projection_values_select(
      'salary_adjusted_points_added'
    ),
    join: league_player_projection_values_join
  },

  player_week_projected_points_added: {
    column_name: 'pts_added',
    table_name: 'league_format_player_projection_values',
    table_alias: league_format_player_projection_values_table_alias,
    select_as: league_format_player_projection_values_select('points_added'),
    join: league_format_player_projection_values_join
  },
  player_week_projected_points: {
    column_name: 'total',
    table_name: 'scoring_format_player_projection_points',
    table_alias: scoring_format_player_projection_points_table_alias,
    select_as: scoring_format_player_projection_points_select('proj_fan_pts'),
    join: scoring_format_player_projection_points_join
  },
  player_week_projected_pass_atts: {
    column_name: 'pa',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_atts'),
    join: projections_index_join
  },
  player_week_projected_pass_comps: {
    column_name: 'pc',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_comps'),
    join: projections_index_join
  },
  player_week_projected_pass_yds: {
    column_name: 'py',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_yds'),
    join: projections_index_join
  },
  player_week_projected_pass_tds: {
    column_name: 'tdp',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_tds'),
    join: projections_index_join
  },
  player_week_projected_pass_ints: {
    column_name: 'ints',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_ints'),
    join: projections_index_join
  },
  player_week_projected_rush_atts: {
    column_name: 'ra',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rush_atts'),
    join: projections_index_join
  },
  player_week_projected_rush_yds: {
    column_name: 'ry',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rush_yds'),
    join: projections_index_join
  },
  player_week_projected_rush_tds: {
    column_name: 'tdr',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rush_tds'),
    join: projections_index_join
  },
  player_week_projected_fumbles_lost: {
    column_name: 'fuml',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('fumbles_lost'),
    join: projections_index_join
  },
  player_week_projected_targets: {
    column_name: 'trg',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('trg'),
    join: projections_index_join
  },
  player_week_projected_recs: {
    column_name: 'rec',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rec'),
    join: projections_index_join
  },
  player_week_projected_rec_yds: {
    column_name: 'recy',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rec_yds'),
    join: projections_index_join
  },
  player_week_projected_rec_tds: {
    column_name: 'tdrec',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rec_tds'),
    join: projections_index_join
  },

  player_season_projected_market_salary: {
    column_name: 'market_salary',
    table_name: 'league_format_player_projection_values',
    table_alias: league_format_player_projection_values_table_alias,
    select_as: league_format_player_projection_values_select('market_salary'),
    join: league_format_player_projection_values_join
  },
  player_season_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_name: 'league_player_projection_values',
    table_alias: league_player_projection_values_table_alias,
    select_as: league_player_projection_values_select(
      'inflation_adjusted_market_salary'
    ),
    join: league_player_projection_values_join
  },
  player_season_projected_points_added: {
    column_name: 'pts_added',
    table_name: 'league_format_player_projection_values',
    table_alias: league_format_player_projection_values_table_alias,
    select_as: league_format_player_projection_values_select('points_added'),
    join: league_format_player_projection_values_join
  },
  player_season_projected_points: {
    column_name: 'total',
    table_name: 'scoring_format_player_projection_points',
    table_alias: scoring_format_player_projection_points_table_alias,
    select_as: scoring_format_player_projection_points_select('proj_fan_pts'),
    join: scoring_format_player_projection_points_join
  },
  player_season_projected_salary_adjusted_points_added: {
    column_name: 'salary_adj_pts_added',
    table_name: 'league_player_projection_values',
    table_alias: league_player_projection_values_table_alias,
    select_as: league_player_projection_values_select(
      'salary_adjusted_points_added'
    ),
    join: league_player_projection_values_join
  },
  player_season_projected_pass_atts: {
    column_name: 'pa',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_atts'),
    join: projections_index_join
  },
  player_season_projected_pass_comps: {
    column_name: 'pc',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_comps'),
    join: projections_index_join
  },
  player_season_projected_pass_yds: {
    column_name: 'py',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_yds'),
    join: projections_index_join
  },
  player_season_projected_pass_tds: {
    column_name: 'tdp',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_tds'),
    join: projections_index_join
  },
  player_season_projected_pass_ints: {
    column_name: 'ints',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('pass_ints'),
    join: projections_index_join
  },
  player_season_projected_rush_atts: {
    column_name: 'ra',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rush_atts'),
    join: projections_index_join
  },
  player_season_projected_rush_yds: {
    column_name: 'ry',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rush_yds'),
    join: projections_index_join
  },
  player_season_projected_rush_tds: {
    column_name: 'tdr',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rush_tds'),
    join: projections_index_join
  },
  player_season_projected_fumbles_lost: {
    column_name: 'fuml',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('fum_lost'),
    join: projections_index_join
  },
  player_season_projected_targets: {
    column_name: 'trg',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('trg'),
    join: projections_index_join
  },
  player_season_projected_recs: {
    column_name: 'rec',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('recs'),
    join: projections_index_join
  },
  player_season_projected_rec_yds: {
    column_name: 'recy',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rec_yds'),
    join: projections_index_join
  },
  player_season_projected_rec_tds: {
    column_name: 'tdrec',
    table_name: 'projections_index',
    table_alias: projections_index_table_alias,
    select_as: projections_index_select('rec_tds'),
    join: projections_index_join
  },

  player_rest_of_season_points_added: {},
  player_rest_of_season_projected_points: {},

  week_opponent_abbreviation: {},
  week_opponent_points_allowed_over_average: {}
}
