import { blake2b } from 'blakejs'

import {
  constants,
  stat_in_year_week,
  nfl_plays_column_params
} from '#libs-shared'
import db from '#db'

const generate_play_by_play_table_alias = ({
  params = {},
  pid_column
} = {}) => {
  if (!pid_column) {
    throw new Error('pid_column is required')
  }
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value) ? value.sort().join('') : value || ''
    })
    .join('')

  const hash = Array.from(blake2b(key, null, 32))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hash
}
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

const get_join_func = (join_type) => {
  switch (join_type) {
    case 'LEFT':
      return 'leftJoin'
    case 'INNER':
      return 'innerJoin'
    default:
      return 'leftJoin'
  }
}

const join_filtered_plays_table = ({
  query,
  table_name,
  pid_column,
  join_type = 'LEFT'
}) => {
  const join_func = get_join_func(join_type)
  query[join_func](table_name, `${table_name}.${pid_column}`, 'player.pid')
}

const player_stat_from_plays = ({ pid_column, select_string, stat_name }) => ({
  table_alias: ({ params }) =>
    generate_play_by_play_table_alias({ params, pid_column }),
  column_name: stat_name,
  select: () => [select_string({ stat_name })],
  pid_column,
  use_with: true,
  join: ({
    query,
    table_name = `filtered_plays_${stat_name}`,
    join_type = 'LEFT'
  }) => {
    join_filtered_plays_table({
      query,
      table_name,
      pid_column,
      join_type
    })
  },
  use_having: true
})

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
    select: () => ['player.fname', 'player.lname']
  },
  player_position: {
    table_name: 'player',
    column_name: 'pos'
  },

  player_height: {
    table_name: 'player',
    column_name: 'height'
  },
  player_weight: {
    table_name: 'player',
    column_name: 'weight'
  },
  player_age: {
    table_name: 'player',
    where_column: () => 'age',
    select_as: () => 'age',
    select: () => [
      `ROUND(DATEDIFF(CURDATE(), STR_TO_DATE(player.dob, '%Y-%m-%d')) / 365.25, 2) as age`
    ]
  },
  player_date_of_birth: {
    table_name: 'player',
    column_name: 'dob'
  },
  player_forty_yard_dash: {
    table_name: 'player',
    column_name: 'forty'
  },
  player_bench_press: {
    table_name: 'player',
    column_name: 'bench'
  },
  player_vertical_jump: {
    table_name: 'player',
    column_name: 'vertical'
  },
  player_broad_jump: {
    table_name: 'player',
    column_name: 'broad'
  },
  player_shuttle_run: {
    table_name: 'player',
    column_name: 'shuttle'
  },
  player_three_cone_drill: {
    table_name: 'player',
    column_name: 'cone'
  },
  player_arm_length: {
    table_name: 'player',
    column_name: 'arm'
  },
  player_hand_size: {
    table_name: 'player',
    column_name: 'hand'
  },
  player_draft_position: {
    table_name: 'player',
    column_name: 'dpos'
  },
  player_draft_round: {
    table_name: 'player',
    column_name: 'round'
  },
  player_college: {
    table_name: 'player',
    column_name: 'col'
  },
  player_college_division: {
    table_name: 'player',
    column_name: 'dv'
  },
  player_starting_nfl_year: {
    table_name: 'player',
    column_name: 'start'
  },
  player_current_nfl_team: {
    table_name: 'player',
    column_name: 'current_nfl_team'
  },
  player_position_depth: {
    table_name: 'player',
    column_name: 'posd'
  },
  player_jersey_number: {
    table_name: 'player',
    column_name: 'jnum'
  },

  // TODO player.dcp ??

  player_league_roster_status: {
    where_column: () => 'player_league_roster_status',
    select: () => [
      `CASE
          WHEN rosters_players.slot = ${constants.slots.IR} THEN 'injured_reserve'
          WHEN rosters_players.slot = ${constants.slots.PS} THEN 'practice_squad'
          WHEN rosters_players.slot IS NULL THEN 'free_agent'
          ELSE 'active_roster'
        END AS player_league_roster_status`,
      'rosters_players.slot',
      'rosters_players.tid',
      'rosters_players.tag'
    ],
    join: ({ query, params = {} }) => {
      const { year = constants.season.year, week = 0, lid = 1 } = params
      query.leftJoin('rosters_players', function () {
        this.on('rosters_players.pid', '=', 'player.pid')
        this.andOn('rosters_players.year', '=', year)
        this.andOn('rosters_players.week', '=', week)
        this.andOn('rosters_players.lid', '=', lid)
      })
    },
    use_having: true
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

  player_pass_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) => `SUM(pass_yds) AS ${stat_name}`,
    stat_name: 'pass_yds_from_plays'
  }),
  player_pass_touchdowns_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN td = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'pass_tds_from_plays'
  }),
  player_pass_interceptions_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN \`int\` = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'pass_ints_from_plays'
  }),
  player_dropped_passing_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN drp = 1 THEN dot ELSE 0 END) AS ${stat_name}`,
    stat_name: 'drop_pass_yds_from_plays'
  }),
  player_pass_completion_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_comp_pct_from_plays'
  }),
  player_pass_touchdown_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN td = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN td = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_td_pct_from_plays'
  }),
  player_pass_interception_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN \`int\` = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN \`int\` = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_int_pct_from_plays'
  }),
  player_pass_interception_worthy_percentage_from_plays: player_stat_from_plays(
    {
      pid_column: 'psr_pid',
      select_string: ({ stat_name }) =>
        `CASE WHEN SUM(CASE WHEN int_worthy = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN int_worthy = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
      stat_name: 'pass_int_worthy_pct_from_plays'
    }
  ),
  player_pass_yards_after_catch_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) => `SUM(yac) AS ${stat_name}`,
    stat_name: 'pass_yds_after_catch_from_plays'
  }),
  player_pass_yards_after_catch_per_completion_from_plays:
    player_stat_from_plays({
      pid_column: 'psr_pid',
      select_string: ({ stat_name }) =>
        `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(yac) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
      stat_name: 'pass_yds_after_catch_per_comp_from_plays'
    }),
  player_pass_yards_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(pass_yds) / SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_yds_per_att_from_plays'
  }),
  player_pass_depth_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(dot) / SUM(CASE WHEN sk is null or sk = 0 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_depth_per_att_from_plays'
  }),
  player_pass_air_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) => `SUM(dot) AS ${stat_name}`,
    stat_name: 'pass_air_yds_from_plays'
  }),
  player_completed_air_yards_per_completion_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(dot) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'comp_air_yds_per_comp_from_plays'
  }),

  // completed air yards / total air yards
  player_passing_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = 1 THEN dot ELSE 0 END) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_air_conv_ratio_from_plays'
  }),
  player_sacked_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN sk = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'sacked_from_plays'
  }),
  player_sacked_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN sk = 1 THEN yds_gained ELSE 0 END) AS ${stat_name}`,
    stat_name: 'sacked_yds_from_plays'
  }),
  player_sacked_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN sk = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN sk = 1 THEN 1 ELSE 0 END) / SUM(CASE WHEN sk = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'sacked_pct_from_plays'
  }),
  player_quarterback_hits_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_hit = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'qb_hit_pct_from_plays'
  }),
  player_quarterback_pressures_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_pressure = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'qb_press_pct_from_plays'
  }),
  player_quarterback_hurries_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_hurry = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'qb_hurry_pct_from_plays'
  }),

  // net yards per passing attempt: (pass yards - sack yards)/(passing attempts + sacks).
  player_pass_net_yards_per_attempt_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND((SUM(pass_yds) - SUM(CASE WHEN sk = 1 THEN yds_gained ELSE 0 END)) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'pass_net_yds_per_att_from_plays'
  }),

  player_rush_yards_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) => `SUM(rush_yds) AS ${stat_name}`,
    stat_name: 'rush_yds_from_plays'
  }),
  player_rush_touchdowns_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN td = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'rush_tds_from_plays'
  }),
  player_rush_yds_per_attempt_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(rush_yds) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'rush_yds_per_att_from_plays'
  }),
  player_rush_attempts_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) => `COUNT(*) AS ${stat_name}`,
    stat_name: 'rush_atts_from_plays'
  }),
  player_rush_first_downs_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN fd = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'rush_first_downs_from_plays'
  }),
  player_positive_rush_attempts_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'positive_rush_atts_from_plays'
  }),
  player_rush_yards_after_contact_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) => `SUM(yaco) AS ${stat_name}`,
    stat_name: 'rush_yds_after_contact_from_plays'
  }),
  player_rush_yards_after_contact_per_attempt_from_plays:
    player_stat_from_plays({
      pid_column: 'bc_pid',
      select_string: ({ stat_name }) =>
        `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(yaco) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
      stat_name: 'rush_yds_after_contact_per_att_from_plays'
    }),

  // TODO
  // player_team_rush_attempts_percentage_from_plays
  // player_team_rush_yards_percentage_from_plays

  player_fumble_percentage_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN player_fuml_pid = bc_pid THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'fumble_pct_from_plays'
  }),
  player_positive_rush_percentage_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'positive_rush_pct_from_plays'
  }),
  player_successful_rush_percentage_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN succ = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'succ_rush_pct_from_plays'
  }),
  player_broken_tackles_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid', // TODO should include bc_pid and trg_pid
    select_string: ({ stat_name }) => `SUM(mbt) AS ${stat_name}`,
    stat_name: 'broken_tackles_from_plays'
  }),
  player_broken_tackles_per_rush_attempt_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(mbt) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'broken_tackles_per_rush_att_from_plays'
  }),
  player_receptions_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'recs_from_plays'
  }),
  player_receiving_yards_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN comp = 1 THEN recv_yds ELSE 0 END) AS ${stat_name}`,
    stat_name: 'rec_yds_from_plays'
  }),
  player_receiving_touchdowns_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN comp = 1 AND td = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'rec_tds_from_plays'
  }),
  player_drops_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN drp = 1 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'drops_from_plays'
  }),
  player_dropped_receiving_yards_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN drp = 1 THEN dot ELSE 0 END) AS ${stat_name}`,
    stat_name: 'drop_rec_yds_from_plays'
  }),
  player_targets_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) => `COUNT(*) AS ${stat_name}`,
    stat_name: 'trg_from_plays'
  }),
  player_deep_targets_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END) AS ${stat_name}`,
    stat_name: 'deep_trg_from_plays'
  }),
  player_deep_targets_percentage_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'deep_trg_pct_from_plays'
  }),
  player_air_yards_per_target_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(dot) / COUNT(*), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'air_yds_per_trg_from_plays'
  }),
  player_air_yards_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) => `SUM(dot) AS ${stat_name}`,
    stat_name: 'air_yds_from_plays'
  }),

  // TODO
  // player_team_air_yards_percentage_from_plays
  // player_team_target_percentage_from_plays
  // player_weighted_opportunity_rating_from_plays

  // receiving yards / air yards
  player_receiver_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = 1 THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'rec_air_conv_ratio_from_plays'
  }),
  player_receiving_yards_per_reception_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN comp = 1 THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'rec_yds_per_rec_from_plays'
  }),
  player_receiving_yards_per_target_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: ({ stat_name }) =>
      `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN comp = 1 THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
    stat_name: 'rec_yds_per_trg_from_plays'
  }),
  player_receiving_yards_after_catch_per_reception_from_plays:
    player_stat_from_plays({
      pid_column: 'trg_pid',
      select_string: ({ stat_name }) =>
        `CASE WHEN SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN comp = 1 THEN yac ELSE 0 END) / SUM(CASE WHEN comp = 1 THEN 1 ELSE 0 END), 2) ELSE 0 END AS ${stat_name}`,
      stat_name: 'rec_yds_after_catch_per_rec_from_plays'
    }),

  week_opponent_abbreviation: {},
  week_opponent_points_allowed_over_average: {}
}
