import { constants } from '#common'

const projections_index_join = ({ query, params = {} }) => {
  const { year = constants.season.year, week = 0 } = params
  query.leftJoin('projections_index', function () {
    this.on('projections_index.pid', '=', 'players.pid')
    this.andOn('projections_index.year', '=', year)
    this.andOn('projections_index.week', '=', week)
    this.andOn('projections_index.sourceid', '=', 0)
  })
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
  const { year = constants.season.year, week = 0, league_format_hash } = params
  query.leftJoin('league_format_player_projection_values', function () {
    this.on('league_format_player_projection_values.pid', '=', 'players.pid')
    this.andOn('league_format_player_projection_values.year', '=', year)
    this.andOn('league_format_player_projection_values.week', '=', week)
    this.andOn(
      'league_format_player_projection_values.league_format_hash',
      '=',
      league_format_hash
    )
  })
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
  const { year = constants.season.year, week = 0, scoring_format_hash } = params
  query.leftJoin('scoring_format_player_projection_points', function () {
    this.on('scoring_format_player_projection_points.pid', '=', 'players.pid')
    this.andOn('scoring_format_player_projection_points.year', '=', year)
    this.andOn('scoring_format_player_projection_points.week', '=', week)
    this.andOn(
      'scoring_format_player_projection_points.scoring_format_hash',
      '=',
      scoring_format_hash
    )
  })
}

const league_player_projection_values_select =
  (stat_desc) =>
  ({ params = {} }) => {
    const { year = constants.season.year, week = 0 } = params
    return `${stat_desc}_in_${year}_week_${week}`
  }

const league_player_projection_values_join = ({ query, params = {} }) => {
  const { year = constants.season.year, week = 0, league_id } = params
  query.leftJoin('league_player_projection_values', function () {
    this.on('league_player_projection_values.pid', '=', 'players.pid')
    this.andOn('league_player_projection_values.year', '=', year)
    this.andOn('league_player_projection_values.week', '=', week)
    this.andOn('league_player_projection_values.lid', '=', league_id)
  })
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
    select_as: league_format_player_projection_values_select('market_salary'),
    join: league_format_player_projection_values_join
  },
  player_week_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_name: 'league_player_projection_values',
    select_as: league_player_projection_values_select(
      'inflation_adjusted_market_salary'
    ),
    join: league_player_projection_values_join
  },
  player_week_projected_salary_adjusted_points_added: {
    column_name: 'points_added_adj',
    table_name: 'league_player_projection_values',
    select_as: league_player_projection_values_select(
      'salary_adjusted_points_added'
    ),
    join: league_player_projection_values_join
  },

  player_week_projected_points_added: {
    column_name: 'points_added',
    table_name: 'league_format_player_projection_values',
    select_as: league_format_player_projection_values_select('points_added'),
    join: league_format_player_projection_values_join
  },
  player_week_projected_points: {
    column_name: 'total',
    table_name: 'scoring_format_player_projection_points',
    select_as: scoring_format_player_projection_points_select('proj_fan_pts'),
    join: scoring_format_player_projection_points_join
  },
  player_week_projected_pass_atts: {
    column_name: 'pa',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_atts'),
    join: projections_index_join
  },
  player_week_projected_pass_comps: {
    column_name: 'pc',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_comps'),
    join: projections_index_join
  },
  player_week_projected_pass_yds: {
    column_name: 'py',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_yds'),
    join: projections_index_join
  },
  player_week_projected_pass_tds: {
    column_name: 'tdp',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_tds'),
    join: projections_index_join
  },
  player_week_projected_pass_ints: {
    column_name: 'ints',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_ints'),
    join: projections_index_join
  },
  player_week_projected_rush_atts: {
    column_name: 'ra',
    table_name: 'projections_index',
    select_as: projections_index_select('rush_atts'),
    join: projections_index_join
  },
  player_week_projected_rush_yds: {
    column_name: 'ry',
    table_name: 'projections_index',
    select_as: projections_index_select('rush_yds'),
    join: projections_index_join
  },
  player_week_projected_rush_tds: {
    column_name: 'tdr',
    table_name: 'projections_index',
    select_as: projections_index_select('rush_tds'),
    join: projections_index_join
  },
  player_week_projected_fumbles_lost: {
    column_name: 'fuml',
    table_name: 'projections_index',
    select_as: projections_index_select('fumbles_lost'),
    join: projections_index_join
  },
  player_week_projected_targets: {
    column_name: 'trg',
    table_name: 'projections_index',
    select_as: projections_index_select('trg'),
    join: projections_index_join
  },
  player_week_projected_recs: {
    column_name: 'rec',
    table_name: 'projections_index',
    select_as: projections_index_select('rec'),
    join: projections_index_join
  },
  player_week_projected_rec_yds: {
    column_name: 'recy',
    table_name: 'projections_index',
    select_as: projections_index_select('rec_yds'),
    join: projections_index_join
  },
  player_week_projected_rec_tds: {
    column_name: 'tdrec',
    table_name: 'projections_index',
    select_as: projections_index_select('rec_tds'),
    join: projections_index_join
  },

  player_season_projected_market_salary: {
    column_name: 'market_salary',
    table_name: 'league_format_player_projection_values',
    select_as: league_format_player_projection_values_select('market_salary'),
    join: league_format_player_projection_values_join
  },
  player_season_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_name: 'league_player_projection_values',
    select_as: league_player_projection_values_select(
      'inflation_adjusted_market_salary'
    ),
    join: league_player_projection_values_join
  },
  player_season_projected_points_added: {
    column_name: 'points_added',
    table_name: 'league_format_player_projection_values',
    select_as: league_format_player_projection_values_select('points_added'),
    join: league_format_player_projection_values_join
  },
  player_season_projected_points: {
    column_name: 'total',
    table_name: 'scoring_format_player_projection_points',
    select_as: scoring_format_player_projection_points_select('proj_fan_pts'),
    join: scoring_format_player_projection_points_join
  },
  player_season_projected_salary_adjusted_points_added: {
    column_name: 'salary_adjusted_points_added',
    table_name: 'league_player_projection_values',
    select_as: league_player_projection_values_select(
      'salary_adjusted_points_added'
    ),
    join: league_player_projection_values_join
  },
  player_season_projected_pass_atts: {
    column_name: 'pa',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_atts'),
    join: projections_index_join
  },
  player_season_projected_pass_comps: {
    column_name: 'pc',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_comps'),
    join: projections_index_join
  },
  player_season_projected_pass_yds: {
    column_name: 'py',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_yds'),
    join: projections_index_join
  },
  player_season_projected_pass_tds: {
    column_name: 'tdp',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_tds'),
    join: projections_index_join
  },
  player_season_projected_pass_ints: {
    column_name: 'ints',
    table_name: 'projections_index',
    select_as: projections_index_select('pass_ints'),
    join: projections_index_join
  },
  player_season_projected_rush_atts: {
    column_name: 'ra',
    table_name: 'projections_index',
    select_as: projections_index_select('rush_atts'),
    join: projections_index_join
  },
  player_season_projected_rush_yds: {
    column_name: 'ry',
    table_name: 'projections_index',
    select_as: projections_index_select('rush_yds'),
    join: projections_index_join
  },
  player_season_projected_rush_tds: {
    column_name: 'tdr',
    table_name: 'projections_index',
    select_as: projections_index_select('rush_tds'),
    join: projections_index_join
  },
  player_season_projected_fumbles_lost: {
    column_name: 'fuml',
    table_name: 'projections_index',
    select_as: projections_index_select('fum_lost'),
    join: projections_index_join
  },
  player_season_projected_targets: {
    column_name: 'trg',
    table_name: 'projections_index',
    select_as: projections_index_select('trg'),
    join: projections_index_join
  },
  player_season_projected_recs: {
    column_name: 'rec',
    table_name: 'projections_index',
    select_as: projections_index_select('recs'),
    join: projections_index_join
  },
  player_season_projected_rec_yds: {
    column_name: 'recy',
    table_name: 'projections_index',
    select_as: projections_index_select('rec_yds'),
    join: projections_index_join
  },
  player_season_projected_rec_tds: {
    column_name: 'tdrec',
    table_name: 'projections_index',
    select_as: projections_index_select('rec_tds'),
    join: projections_index_join
  },

  player_rest_of_season_points_added: {},
  player_rest_of_season_projected_points: {},

  week_opponent_abbreviation: {},
  week_opponent_points_allowed_over_average: {}
}
