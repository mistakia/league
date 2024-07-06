import db from '#db'
import { nfl_plays_column_params, players_table_constants } from '#libs-shared'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import get_join_func from '#libs-server/get-join-func.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'

const generate_table_alias = ({ type, params = {}, pid_column } = {}) => {
  if (!type) {
    throw new Error('type is required')
  }

  if (!pid_column) {
    throw new Error('pid_column is required')
  }

  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  return get_table_hash(`${type}_${pid_column}_${key}`)
}

const join_filtered_plays_table = ({
  query,
  table_name,
  pid_column,
  join_type = 'LEFT',
  splits = [],
  previous_table_name = null
}) => {
  const join_func = get_join_func(join_type)
  if (previous_table_name) {
    query[join_func](table_name, function () {
      this.on(`${table_name}.${pid_column}`, '=', 'player.pid')
      for (const split of splits) {
        this.andOn(
          `${table_name}.${split}`,
          '=',
          `${previous_table_name}.${split}`
        )
      }
    })
  } else {
    query[join_func](table_name, `${table_name}.${pid_column}`, 'player.pid')
  }
}

const player_stat_from_plays = ({ pid_column, select_string, stat_name }) => ({
  table_alias: ({ params }) =>
    generate_table_alias({ type: 'play_by_play', params, pid_column }),
  column_name: stat_name,
  select: () => [`${select_string} as ${stat_name}_0`],
  where_column: () => select_string,
  pid_column,
  use_play_by_play_with: true,
  join: ({
    query,
    table_name = `filtered_plays_${stat_name}`,
    join_type = 'LEFT',
    splits = [],
    previous_table_name = null
  }) => {
    join_filtered_plays_table({
      query,
      table_name,
      pid_column,
      join_type,
      splits,
      previous_table_name
    })
  },
  use_having: true,
  supported_splits: ['year']
})

const create_team_share_stat = ({
  column_name,
  pid_column,
  select_string
}) => ({
  column_name,
  where_column: () => select_string,
  use_having: true,
  with: ({
    query,
    with_table_name,
    params,
    having_clauses = [],
    splits = []
  }) => {
    const with_query = db('nfl_plays')
      .select('pg.pid')
      .select(db.raw(`${select_string} as ${column_name}`))
      .join('player_gamelogs as pg', function () {
        this.on('nfl_plays.esbid', '=', 'pg.esbid').andOn(
          'nfl_plays.off',
          '=',
          'pg.tm'
        )
      })
      .whereNot('play_type', 'NOPL')
      .where('nfl_plays.seas_type', 'REG')
      .whereNotNull(pid_column)
      .groupBy('pg.pid')

    for (const split of splits) {
      if (players_table_constants.split_params.includes(split)) {
        const column_param_definition = nfl_plays_column_params[split]
        const table_name = column_param_definition.table || 'nfl_plays'
        const split_statement = `${table_name}.${split}`
        with_query.select(split_statement)
        with_query.groupBy(split_statement)
      }
    }

    // Handle career_year
    if (params.career_year) {
      with_query.join('player_seasonlogs', function () {
        this.on('nfl_plays.year', '=', 'player_seasonlogs.year')
          .andOn('nfl_plays.seas_type', '=', 'player_seasonlogs.seas_type')
          .andOn('pg.pid', '=', 'player_seasonlogs.pid')
      })
      with_query.whereBetween('player_seasonlogs.career_year', [
        Math.min(params.career_year[0], params.career_year[1]),
        Math.max(params.career_year[0], params.career_year[1])
      ])
    }

    // Handle career_game
    if (params.career_game) {
      with_query.whereBetween('pg.career_game', [
        Math.min(params.career_game[0], params.career_game[1]),
        Math.max(params.career_game[0], params.career_game[1])
      ])
    }

    // Remove career_year and career_game from params before applying other filters
    const filtered_params = { ...params }
    delete filtered_params.career_year
    delete filtered_params.career_game

    apply_play_by_play_column_params_to_query({
      query: with_query,
      params: filtered_params
    })

    const unique_having_clauses = new Set(having_clauses)
    for (const having_clause of unique_having_clauses) {
      with_query.havingRaw(having_clause)
    }

    query.with(with_table_name, with_query)
  },
  table_alias: ({ params }) =>
    generate_table_alias({ type: column_name, params, pid_column }),
  join: ({
    query,
    table_name,
    join_type,
    splits = [],
    previous_table_name = null
  }) => {
    join_filtered_plays_table({
      query,
      table_name,
      pid_column: 'pid',
      join_type,
      splits,
      previous_table_name
    })
  },
  supported_splits: ['year']
})

export default {
  player_pass_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(pass_yds)`,
    stat_name: 'pass_yds_from_plays'
  }),
  player_pass_attempts_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `COUNT(*)`,
    stat_name: 'pass_atts_from_plays'
  }),
  player_pass_touchdowns_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    stat_name: 'pass_tds_from_plays'
  }),
  player_pass_interceptions_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(CASE WHEN int = true THEN 1 ELSE 0 END)`,
    stat_name: 'pass_ints_from_plays'
  }),
  player_dropped_passing_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(CASE WHEN drp = true THEN dot ELSE 0 END)`,
    stat_name: 'drop_pass_yds_from_plays'
  }),
  player_pass_completion_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_comp_pct_from_plays'
  }),
  player_pass_touchdown_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN td = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN td = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_td_pct_from_plays'
  }),
  player_pass_interception_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN int = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN int = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_int_pct_from_plays'
  }),
  player_pass_interception_worthy_percentage_from_plays: player_stat_from_plays(
    {
      pid_column: 'psr_pid',
      select_string: `CASE WHEN SUM(CASE WHEN int_worthy = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN int_worthy = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
      stat_name: 'pass_int_worthy_pct_from_plays'
    }
  ),
  player_pass_yards_after_catch_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(yac)`,
    stat_name: 'pass_yds_after_catch_from_plays'
  }),
  player_pass_yards_after_catch_per_completion_from_plays:
    player_stat_from_plays({
      pid_column: 'psr_pid',
      select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(yac) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
      stat_name: 'pass_yds_after_catch_per_comp_from_plays'
    }),
  player_pass_yards_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(pass_yds) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_yds_per_att_from_plays'
  }),
  player_pass_depth_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(dot) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_depth_per_att_from_plays'
  }),
  player_pass_air_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(dot)`,
    stat_name: 'pass_air_yds_from_plays'
  }),
  player_completed_air_yards_per_completion_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(dot) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'comp_air_yds_per_comp_from_plays'
  }),

  // completed air yards / total air yards
  player_passing_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN dot ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_air_conv_ratio_from_plays'
  }),
  player_sacked_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(CASE WHEN sk = true THEN 1 ELSE 0 END)`,
    stat_name: 'sacked_from_plays'
  }),
  player_sacked_yards_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `SUM(CASE WHEN sk = true THEN yds_gained ELSE 0 END)`,
    stat_name: 'sacked_yds_from_plays'
  }),
  player_sacked_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN SUM(CASE WHEN sk = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN sk = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'sacked_pct_from_plays'
  }),
  player_quarterback_hits_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_hit = true THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'qb_hit_pct_from_plays'
  }),
  player_quarterback_pressures_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_pressure = true THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'qb_press_pct_from_plays'
  }),
  player_quarterback_hurries_percentage_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_hurry = true THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'qb_hurry_pct_from_plays'
  }),

  // net yards per passing attempt: (pass yards - sack yards)/(passing attempts + sacks).
  player_pass_net_yards_per_attempt_from_plays: player_stat_from_plays({
    pid_column: 'psr_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND((SUM(pass_yds) - SUM(CASE WHEN sk = true THEN yds_gained ELSE 0 END)) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'pass_net_yds_per_att_from_plays'
  }),

  player_rush_yards_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `SUM(rush_yds)`,
    stat_name: 'rush_yds_from_plays'
  }),
  player_rush_touchdowns_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    stat_name: 'rush_tds_from_plays'
  }),
  player_rush_yds_per_attempt_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(rush_yds) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'rush_yds_per_att_from_plays'
  }),
  player_rush_attempts_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `COUNT(*)`,
    stat_name: 'rush_atts_from_plays'
  }),
  player_rush_first_downs_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `SUM(CASE WHEN fd = true THEN 1 ELSE 0 END)`,
    stat_name: 'rush_first_downs_from_plays'
  }),
  player_positive_rush_attempts_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END)`,
    stat_name: 'positive_rush_atts_from_plays'
  }),
  player_rush_yards_after_contact_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `SUM(yaco)`,
    stat_name: 'rush_yds_after_contact_from_plays'
  }),
  player_rush_yards_after_contact_per_attempt_from_plays:
    player_stat_from_plays({
      pid_column: 'bc_pid',
      select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(yaco) / COUNT(*), 2) ELSE 0 END`,
      stat_name: 'rush_yds_after_contact_per_att_from_plays'
    }),

  player_rush_attempts_share_from_plays: create_team_share_stat({
    column_name: 'rush_att_share_from_plays',
    pid_column: 'bc_pid',
    select_string:
      'ROUND(100.0 * COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2)'
  }),
  player_rush_yards_share_from_plays: create_team_share_stat({
    column_name: 'rush_yds_share_from_plays',
    pid_column: 'bc_pid',
    select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.bc_pid = pg.pid THEN nfl_plays.rush_yds ELSE 0 END) / SUM(nfl_plays.rush_yds), 2)'
  }),

  player_fumble_percentage_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN player_fuml_pid = bc_pid THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'fumble_pct_from_plays'
  }),
  player_positive_rush_percentage_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'positive_rush_pct_from_plays'
  }),
  player_successful_rush_percentage_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN succ = true THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'succ_rush_pct_from_plays'
  }),
  player_broken_tackles_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid', // TODO should include bc_pid and trg_pid
    select_string: `SUM(mbt)`,
    stat_name: 'broken_tackles_from_plays'
  }),
  player_broken_tackles_per_rush_attempt_from_plays: player_stat_from_plays({
    pid_column: 'bc_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(mbt) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'broken_tackles_per_rush_att_from_plays'
  }),
  player_receptions_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    stat_name: 'recs_from_plays'
  }),
  player_receiving_yards_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)`,
    stat_name: 'rec_yds_from_plays'
  }),
  player_receiving_touchdowns_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(CASE WHEN comp = true AND td = true THEN 1 ELSE 0 END)`,
    stat_name: 'rec_tds_from_plays'
  }),
  player_drops_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(CASE WHEN drp = true THEN 1 ELSE 0 END)`,
    stat_name: 'drops_from_plays'
  }),
  player_dropped_receiving_yards_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(CASE WHEN drp = true THEN dot ELSE 0 END)`,
    stat_name: 'drop_rec_yds_from_plays'
  }),
  player_targets_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `COUNT(*)`,
    stat_name: 'trg_from_plays'
  }),
  player_deep_targets_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END)`,
    stat_name: 'deep_trg_from_plays'
  }),
  player_deep_targets_percentage_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'deep_trg_pct_from_plays'
  }),
  player_air_yards_per_target_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(dot) / COUNT(*), 2) ELSE 0 END`,
    stat_name: 'air_yds_per_trg_from_plays'
  }),
  player_air_yards_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `SUM(dot)`,
    stat_name: 'air_yds_from_plays'
  }),

  player_air_yards_share_from_plays: create_team_share_stat({
    column_name: 'air_yds_share_from_plays',
    pid_column: 'trg_pid',
    select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2)'
  }),
  player_target_share_from_plays: create_team_share_stat({
    column_name: 'trg_share_from_plays',
    pid_column: 'trg_pid',
    select_string:
      'ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / COUNT(*), 2)'
  }),
  player_weighted_opportunity_rating_from_plays: create_team_share_stat({
    column_name: 'weighted_opp_rating_from_plays',
    pid_column: 'trg_pid',
    select_string:
      'ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(COUNT(*), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4)'
  }),

  // receiving yards / air yards
  player_receiver_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 4) ELSE 0 END`,
    stat_name: 'rec_air_conv_ratio_from_plays'
  }),
  player_receiving_yards_per_reception_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'rec_yds_per_rec_from_plays'
  }),
  player_receiving_yards_per_target_from_plays: player_stat_from_plays({
    pid_column: 'trg_pid',
    select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'rec_yds_per_trg_from_plays'
  }),
  player_receiving_yards_after_catch_per_reception_from_plays:
    player_stat_from_plays({
      pid_column: 'trg_pid',
      select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN comp = true THEN yac ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
      stat_name: 'rec_yds_after_catch_per_rec_from_plays'
    })
}