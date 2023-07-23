import { constants, stat_in_year_week } from '#libs-shared'
import db from '#db'

const projections_index_join = ({ query, params = {} }) => {
  const table_alias = projections_index_table_alias({ params })
  const { year = constants.season.year, week = 0 } = params
  query.leftJoin(`projections_index as ${table_alias}`, function () {
    this.on(`${table_alias}.pid`, '=', 'player.pid')
    this.andOn(`${table_alias}.year`, '=', year)
    this.andOn(`${table_alias}.week`, '=', week)
    this.andOn(`${table_alias}.sourceid`, '=', constants.sources.AVERAGE)
  })
}

const projections_index_table_alias = ({ params = {} }) => {
  const { year = constants.season.year, week = 0 } = params
  return `projections_index_${year}_week_${week}`
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

const league_player_projection_values_join = ({ query, params = {} }) => {
  const { year = constants.season.year, week = 0, league_id = 1 } = params
  const table_alias = league_player_projection_values_table_alias({ params })
  query.leftJoin(
    `league_player_projection_values as ${table_alias}`,
    function () {
      this.on(`${table_alias}.pid`, '=', 'player.pid')
      this.andOn(`${table_alias}.year`, '=', year)
      this.andOn(db.raw(`${table_alias}.week = '${week}'`))
      this.andOn(`${table_alias}.lid`, '=', league_id)
    }
  )
}

const league_player_projection_values_table_alias = ({ params = {} }) => {
  const { year = constants.season.year, week = 0, league_id = 1 } = params
  return `league_player_projection_values_${year}_week_${week}_league_${league_id}`
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

export default {
  player_name: {
    table_name: 'player',
    where_column: ({ case_insensitive = false }) => {
      if (case_insensitive) {
        return db.raw(`UPPER(CONCAT(player.fname, ' ', player.lname))`)
      } else {
        return db.raw(`CONCAT(player.fname, ' ', player.lname)`)
      }
    },
    select: ({ query, params }) => {
      query.select('player.fname', 'player.lname')
    }
  },
  player_position: {
    table_name: 'player',
    column_name: 'pos'
  },
  player_league_salary: {
    column_name: 'value',
    table_name: 'transactions',
    table_alias: () => 'latest_transactions',
    select_as: () => 'player_salary',
    join: ({ query, params = {} }) => {
      const { lid = 1 } = params
      query.leftJoin(
        db('transactions')
          .select('pid')
          .select(db.raw('MAX(timestamp) as latest_timestamp'))
          .where('lid', lid)
          .groupBy('pid')
          .as('transactions'),
        'transactions.pid',
        'player.pid'
      )
      query.leftJoin('transactions as latest_transactions', function () {
        this.on('latest_transactions.pid', '=', 'player.pid')
        this.andOn(
          'latest_transactions.timestamp',
          '=',
          'transactions.latest_timestamp'
        )
      })
    }
  },

  player_week_projected_market_salary: player_projected_market_salary,
  player_season_projected_market_salary: player_projected_market_salary,
  player_rest_of_season_projected_market_salary: player_projected_market_salary,

  player_season_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_name: 'league_player_projection_values',
    table_alias: league_player_projection_values_table_alias,
    select_as: stat_in_year_week('inflation_adjusted_market_salary'),
    join: league_player_projection_values_join
  },

  player_week_projected_salary_adjusted_points_added:
    player_projected_salary_adjusted_points_added,
  player_season_projected_salary_adjusted_points_added:
    player_projected_salary_adjusted_points_added,
  player_rest_of_season_projected_salary_adjusted_points_added:
    player_projected_salary_adjusted_points_added,

  player_week_projected_points_added: player_projected_points_added,
  player_season_projected_points_added: player_projected_points_added,
  player_rest_of_season_projected_points_added: player_projected_points_added,

  player_week_projected_points: player_projected_points,
  player_season_projected_points: player_projected_points,
  player_rest_of_season_projected_points: player_projected_points,

  player_week_projected_pass_atts: player_projected_pass_atts,
  player_season_projected_pass_atts: player_projected_pass_atts,
  player_rest_of_season_projected_pass_atts: player_projected_pass_atts,

  player_week_projected_pass_comps: player_projected_pass_comps,
  player_season_projected_pass_comps: player_projected_pass_comps,
  player_rest_of_season_projected_pass_comps: player_projected_pass_comps,

  player_week_projected_pass_yds: player_projected_pass_yds,
  player_season_projected_pass_yds: player_projected_pass_yds,
  player_rest_of_season_projected_pass_yds: player_projected_pass_yds,

  player_week_projected_pass_tds: player_projected_pass_tds,
  player_season_projected_pass_tds: player_projected_pass_tds,
  player_rest_of_season_projected_pass_tds: player_projected_pass_tds,

  player_week_projected_pass_ints: player_projected_pass_ints,
  player_season_projected_pass_ints: player_projected_pass_ints,
  player_rest_of_season_projected_pass_ints: player_projected_pass_ints,

  player_week_projected_rush_atts: player_projected_rush_atts,
  player_season_projected_rush_atts: player_projected_rush_atts,
  player_rest_of_season_projected_rush_atts: player_projected_rush_atts,

  player_week_projected_rush_yds: player_projected_rush_yds,
  player_season_projected_rush_yds: player_projected_rush_yds,
  player_rest_of_season_projected_rush_yds: player_projected_rush_yds,

  player_week_projected_rush_tds: player_projected_rush_tds,
  player_season_projected_rush_tds: player_projected_rush_tds,
  player_rest_of_season_projected_rush_tds: player_projected_rush_tds,

  player_week_projected_fumbles_lost: player_projected_fumbles_lost,
  player_season_projected_fumbles_lost: player_projected_fumbles_lost,
  player_rest_of_season_projected_fumbles_lost: player_projected_fumbles_lost,

  player_week_projected_targets: player_projected_targets,
  player_season_projected_targets: player_projected_targets,
  player_rest_of_season_projected_targets: player_projected_targets,

  player_week_projected_recs: player_projected_recs,
  player_season_projected_recs: player_projected_recs,
  player_rest_of_season_projected_recs: player_projected_recs,

  player_week_projected_rec_yds: player_projected_rec_yds,
  player_season_projected_rec_yds: player_projected_rec_yds,
  player_rest_of_season_projected_rec_yds: player_projected_rec_yds,

  player_week_projected_rec_tds: player_projected_rec_tds,
  player_season_projected_rec_tds: player_projected_rec_tds,
  player_rest_of_season_projected_rec_tds: player_projected_rec_tds,

  player_pass_yards_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_yds',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN nfl_plays.pass_yds ELSE 0 END) AS pass_yds'
        )
      )
    },
    use_having: true
  },
  player_pass_touchdowns_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_tds',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.td = 1 THEN 1 ELSE 0 END) AS pass_tds'
        )
      )
    },
    use_having: true
  },
  player_pass_interceptions_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_ints',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.int = 1 THEN 1 ELSE 0 END) AS pass_ints'
        )
      )
    },
    use_having: true
  },
  player_dropped_passing_yards_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'drop_pass_yds',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.drp = 1 THEN nfl_plays.dot ELSE 0 END) AS drop_pass_yds'
        )
      )
    },
    use_having: true
  },
  player_pass_completion_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_comp_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_comp_pct'
        )
      )
    },
    use_having: true
  },
  player_pass_touchdown_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_td_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.td = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.td = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_td_pct'
        )
      )
    },
    use_having: true
  },
  player_pass_interception_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_int_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.int = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.int = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_int_pct'
        )
      )
    },
    use_having: true
  },
  player_pass_interception_worthy_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_int_worthy_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.intw = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.int_worthy = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_int_worthy_pct'
        )
      )
    }
  },
  player_pass_yards_after_catch_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_yds_after_catch',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN nfl_plays.yac ELSE 0 END) AS pass_yds_after_catch'
        )
      )
    },
    use_having: true
  },
  player_pass_yards_after_catch_per_completion_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_yds_after_catch_per_comp',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN nfl_plays.yac ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_yds_after_catch_per_comp'
        )
      )
    },
    use_having: true
  },
  player_pass_yards_per_pass_attempt_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_yds_per_att',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN nfl_plays.pass_yds ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_yds_per_att'
        )
      )
    },
    use_having: true
  },
  player_pass_depth_per_pass_attempt_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_depth_per_att',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN nfl_plays.dot ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND (nfl_plays.sk is null or nfl_plays.sk = 0) THEN 1 ELSE 0 END), 2) ELSE 0 END AS pass_depth_per_att'
        )
      )
    },
    use_having: true
  },
  player_pass_air_yards_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'pass_air_yds',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN nfl_plays.dot ELSE 0 END) AS pass_air_yds'
        )
      )
    },
    use_having: true
  },
  player_completed_air_yards_per_completion_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'comp_air_yds_per_comp',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN nfl_plays.dot ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS comp_air_yds_per_comp'
        )
      )
    },
    use_having: true
  },

  // player_passing_air_conversion_ratio_from_plays

  player_sacked_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'sacked',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.sk = 1 THEN 1 ELSE 0 END) AS sacked'
        )
      )
    },
    use_having: true
  },
  player_sacked_yards_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'sacked_yds',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.sk = 1 THEN nfl_plays.yds_gained ELSE 0 END) AS sacked_yds'
        )
      )
    },
    use_having: true
  },
  player_sacked_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'psr_pid',
    select_as: () => 'sacked_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.psr_pid = player.pid AND nfl_plays.sk = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.psr_pid = player.pid THEN 1 ELSE 0 END), 2) ELSE 0 END AS sacked_pct'
        )
      )
    },
    use_having: true
  },
  player_quarterback_hits_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'qbp_pid',
    select_as: () => 'qb_hit_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.qbp_pid = player.pid THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.qbp_pid = player.pid AND nfl_plays.qbhi = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.qbp_pid = player.pid THEN 1 ELSE 0 END), 2) ELSE 0 END AS qb_hit_pct'
        )
      )
    },
    use_having: true
  },
  player_quarterback_pressures_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'qbp_pid',
    select_as: () => 'qb_press_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.qbp_pid = player.pid THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.qbp_pid = player.pid AND nfl_plays.qbp = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.qbp_pid = player.pid THEN 1 ELSE 0 END), 2) ELSE 0 END AS qb_press_pct'
        )
      )
    },
    use_having: true
  },
  player_quarterback_hurries_percentage_from_plays: {
    table_name: 'nfl_plays',
    nfl_plays_join_on: 'qbp_pid',
    select_as: () => 'qb_hurry_pct',
    select: ({ query, params = {} }) => {
      query.select(
        db.raw(
          'CASE WHEN SUM(CASE WHEN nfl_plays.qbp_pid = player.pid THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN nfl_plays.qbp_pid = player.pid AND nfl_plays.qbhu = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN nfl_plays.qbp_pid = player.pid THEN 1 ELSE 0 END), 2) ELSE 0 END AS qb_hurry_pct'
        )
      )
    },
    use_having: true
  },

  // player_pass_net_yards_per_attempt_from_plays:

  week_opponent_abbreviation: {},
  week_opponent_points_allowed_over_average: {}
}
