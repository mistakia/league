import db from '#db'
import { nfl_plays_column_params, players_table_constants } from '#libs-shared'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import players_table_join_function from '#libs-server/players-table/players-table-join-function.mjs'
import { add_player_stats_play_by_play_with_statement } from '#libs-server/players-table/add-player-stats-play-by-play-with-statement.mjs'

const generate_table_alias = ({ type, params = {}, pid_columns } = {}) => {
  if (!type) {
    throw new Error('type is required')
  }

  if (!pid_columns || !Array.isArray(pid_columns) || pid_columns.length === 0) {
    throw new Error('pid_columns must be a non-empty array')
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

  const pid_columns_string = pid_columns.sort().join('_')
  return get_table_hash(`${type}_${pid_columns_string}_${key}`)
}

const player_stat_from_plays = ({
  pid_columns,
  with_select_string,
  stat_name,
  numerator_select,
  denominator_select,
  has_numerator_denominator = false
}) => ({
  table_alias: ({ params }) =>
    generate_table_alias({ type: 'play_by_play', params, pid_columns }),
  column_name: stat_name,
  with_select: ({ params = {} }) => {
    if (
      params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1 &&
      has_numerator_denominator
    ) {
      return [
        `${numerator_select} as ${stat_name}_numerator`,
        `${denominator_select} as ${stat_name}_denominator`
      ]
    }
    return [`${with_select_string} as ${stat_name}`]
  },
  has_numerator_denominator,
  with_where: ({ params }) => {
    if (
      params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1 &&
      has_numerator_denominator
    ) {
      return null // No where clause in the WITH statement when using year_offset range with numerator/denominator
    }
    return with_select_string
  },
  main_where: ({ params, table_name }) => {
    if (
      params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1 &&
      has_numerator_denominator
    ) {
      return `CASE WHEN SUM(${table_name}.${stat_name}_denominator) > 0 THEN ROUND(100.0 * SUM(${table_name}.${stat_name}_numerator) / SUM(${table_name}.${stat_name}_denominator), 2) ELSE 0 END`
    }
    return null
  },
  pid_columns,
  with: add_player_stats_play_by_play_with_statement,
  join: (args) =>
    players_table_join_function({ ...args, join_year_on_year_split: true }),
  use_having: true,
  supported_splits: ['year', 'week'],
  supported_rate_types: ['per_game']
})

const create_team_share_stat = ({
  column_name,
  pid_columns,
  with_select_string,
  numerator_select,
  denominator_select,
  has_numerator_denominator = false,
  with_select_string_year_offset_range,
  main_select_string_year_offset_range
}) => ({
  column_name,
  with_where: ({ params }) => {
    if (
      params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1 &&
      has_numerator_denominator
    ) {
      // No where clause in the WITH statement when using year_offset range with numerator/denominator
      return null
    }
    return with_select_string
  },
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
      .join('player_gamelogs as pg', function () {
        this.on('nfl_plays.esbid', '=', 'pg.esbid').andOn(
          'nfl_plays.off',
          '=',
          'pg.tm'
        )
      })
      .whereNot('play_type', 'NOPL')
      .where('nfl_plays.seas_type', 'REG')
      .where(function () {
        for (const pid_column of pid_columns) {
          this.orWhereNotNull(pid_column)
        }
      })
      .groupBy('pg.pid')

    if (
      params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1
    ) {
      if (has_numerator_denominator) {
        with_query.select(
          db.raw(`${numerator_select} as ${column_name}_numerator`)
        )
        with_query.select(
          db.raw(`${denominator_select} as ${column_name}_denominator`)
        )
      } else if (with_select_string_year_offset_range) {
        with_query.select(db.raw(with_select_string_year_offset_range))
      }
    } else {
      with_query.select(db.raw(`${with_select_string} as ${column_name}`))
    }

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
    generate_table_alias({ type: column_name, params, pid_columns }),
  join: (args) =>
    players_table_join_function({ ...args, join_year_on_year_split: true }),
  supported_splits: ['year', 'week'],
  has_numerator_denominator,
  main_select_string_year_offset_range,
  main_where: ({ params, table_name }) => {
    if (
      params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1
    ) {
      if (has_numerator_denominator) {
        return `CASE WHEN SUM(${table_name}.${column_name}_denominator) > 0 THEN ROUND(100.0 * SUM(${table_name}.${column_name}_numerator) / SUM(${table_name}.${column_name}_denominator), 2) ELSE 0 END`
      } else if (main_select_string_year_offset_range) {
        return main_select_string_year_offset_range({ table_name, params })
      }
    }
    return null
  }
})

export default {
  player_pass_yards_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(pass_yds)`,
    stat_name: 'pass_yds_from_plays'
  }),
  player_pass_attempts_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`,
    stat_name: 'pass_atts_from_plays'
  }),
  player_pass_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    stat_name: 'pass_tds_from_plays'
  }),
  player_pass_interceptions_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(CASE WHEN int = true THEN 1 ELSE 0 END)`,
    stat_name: 'pass_ints_from_plays'
  }),
  player_dropped_passing_yards_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(CASE WHEN dropped_pass = true THEN dot ELSE 0 END)`,
    stat_name: 'drop_pass_yds_from_plays'
  }),
  player_pass_completion_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_comp_pct_from_plays',
    numerator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_pass_touchdown_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN td = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN td = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_td_pct_from_plays',
    numerator_select: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_pass_interception_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN int = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN int = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_int_pct_from_plays',
    numerator_select: `SUM(CASE WHEN int = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_pass_interception_worthy_percentage_from_plays: player_stat_from_plays(
    {
      pid_columns: ['psr_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN int_worthy = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN int_worthy = true THEN 1 ELSE 0 END) / SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END), 2) ELSE 0 END`,
      stat_name: 'pass_int_worthy_pct_from_plays',
      numerator_select: `SUM(CASE WHEN int_worthy = true THEN 1 ELSE 0 END)`,
      denominator_select: `SUM(CASE WHEN sk is null or sk = false THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true
    }
  ),
  player_pass_yards_after_catch_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(yards_after_catch)`,
    stat_name: 'pass_yds_after_catch_from_plays'
  }),
  player_pass_yards_after_catch_per_completion_from_plays:
    player_stat_from_plays({
      pid_columns: ['psr_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(yards_after_catch) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
      stat_name: 'pass_yds_after_catch_per_comp_from_plays',
      numerator_select: `SUM(yards_after_catch)`,
      denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true
    }),
  player_pass_yards_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(pass_yds) / SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'pass_yds_per_att_from_plays',
    numerator_select: `SUM(pass_yds)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_pass_depth_per_pass_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(dot) / SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'pass_depth_per_att_from_plays',
    numerator_select: `SUM(dot)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_pass_air_yards_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(dot)`,
    stat_name: 'pass_air_yds_from_plays'
  }),
  player_completed_air_yards_per_completion_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(dot) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'comp_air_yds_per_comp_from_plays',
    numerator_select: `SUM(dot)`,
    denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  // completed air yards / total air yards
  player_passing_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN dot ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'pass_air_conv_ratio_from_plays',
    numerator_select: `SUM(CASE WHEN comp = true THEN dot ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_sacked_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(CASE WHEN sk = true THEN 1 ELSE 0 END)`,
    stat_name: 'sacked_from_plays'
  }),
  player_sacked_yards_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `SUM(CASE WHEN sk = true THEN yds_gained ELSE 0 END)`,
    stat_name: 'sacked_yds_from_plays'
  }),
  player_sacked_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN sk = true THEN 1 ELSE 0 END) / SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'sacked_pct_from_plays',
    numerator_select: `SUM(CASE WHEN sk = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_quarterback_hits_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_hit = true AND psr_pid IS NOT NULL THEN 1 ELSE 0 END) / SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'qb_hit_pct_from_plays',
    numerator_select: `SUM(CASE WHEN qb_hit = true AND psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_quarterback_pressures_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_pressure = true AND psr_pid IS NOT NULL THEN 1 ELSE 0 END) / SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'qb_press_pct_from_plays',
    numerator_select: `SUM(CASE WHEN qb_pressure = true AND psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_quarterback_hurries_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN qb_hurry = true AND psr_pid IS NOT NULL THEN 1 ELSE 0 END) / SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'qb_hurry_pct_from_plays',
    numerator_select: `SUM(CASE WHEN qb_hurry = true AND psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  // net yards per passing attempt: (pass yards - sack yards)/(passing attempts + sacks).
  // sacks included in calculation because psr_pid is set on all attempts or sacks
  player_pass_net_yards_per_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['psr_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND((SUM(pass_yds) - SUM(CASE WHEN sk = true THEN yds_gained ELSE 0 END))::decimal / SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'pass_net_yds_per_att_from_plays',
    numerator_select: `SUM(pass_yds) - SUM(CASE WHEN sk = true THEN yds_gained ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN psr_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  player_rush_yards_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `SUM(rush_yds)`,
    stat_name: 'rush_yds_from_plays'
  }),
  player_rush_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    stat_name: 'rush_tds_from_plays'
  }),
  player_rush_yds_per_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(rush_yds)::decimal / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'rush_yds_per_att_from_plays',
    numerator_select: `SUM(rush_yds)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_rush_attempts_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `COUNT(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE NULL END)`,
    stat_name: 'rush_atts_from_plays'
  }),
  player_rush_first_downs_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `SUM(CASE WHEN first_down = true THEN 1 ELSE 0 END)`,
    stat_name: 'rush_first_downs_from_plays'
  }),
  player_positive_rush_attempts_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END)`,
    stat_name: 'positive_rush_atts_from_plays'
  }),
  player_rush_yards_after_contact_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `SUM(yards_after_any_contact)`,
    stat_name: 'rush_yds_after_contact_from_plays'
  }),
  player_rush_yards_after_contact_per_attempt_from_plays:
    player_stat_from_plays({
      pid_columns: ['bc_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(yards_after_any_contact)::decimal / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
      stat_name: 'rush_yds_after_contact_per_att_from_plays',
      numerator_select: `SUM(yards_after_any_contact)`,
      denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true
    }),
  player_rush_first_down_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN first_down = true THEN 1 ELSE 0 END) / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'rush_first_down_pct_from_plays',
    numerator_select: `SUM(CASE WHEN first_down = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_weighted_opportunity_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid', 'trg_pid'],
    with_select_string: `ROUND(SUM(CASE WHEN nfl_plays.ydl_100 <= 20 AND bc_pid IS NOT NULL THEN 1.30 WHEN nfl_plays.ydl_100 <= 20 AND trg_pid IS NOT NULL THEN 2.25 WHEN nfl_plays.ydl_100 > 20 AND bc_pid IS NOT NULL THEN 0.48 WHEN nfl_plays.ydl_100 > 20 AND trg_pid IS NOT NULL THEN 1.43 ELSE 0 END), 2)`,
    stat_name: 'weighted_opportunity_from_plays'
  }),

  player_rush_attempts_share_from_plays: create_team_share_stat({
    column_name: 'rush_att_share_from_plays',
    pid_columns: ['bc_pid'],
    with_select_string:
      'CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2) ELSE 0 END',
    numerator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_rush_yards_share_from_plays: create_team_share_stat({
    column_name: 'rush_yds_share_from_plays',
    pid_columns: ['bc_pid'],
    with_select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.bc_pid = pg.pid THEN nfl_plays.rush_yds ELSE 0 END) / SUM(nfl_plays.rush_yds), 2)',
    numerator_select: `SUM(CASE WHEN nfl_plays.bc_pid = pg.pid THEN nfl_plays.rush_yds ELSE 0 END)`,
    denominator_select: `SUM(nfl_plays.rush_yds)`,
    has_numerator_denominator: true
  }),
  player_rush_first_down_share_from_plays: create_team_share_stat({
    column_name: 'rush_first_down_share_from_plays',
    pid_columns: ['bc_pid'],
    with_select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.bc_pid = pg.pid THEN CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END), 0), 2)',
    numerator_select: `SUM(CASE WHEN nfl_plays.bc_pid = pg.pid THEN CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  player_opportunity_share_from_plays: create_team_share_stat({
    column_name: 'opportunity_share_from_plays',
    pid_columns: ['bc_pid', 'trg_pid'],
    with_select_string: `ROUND(100.0 * (COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)) / NULLIF(SUM(CASE WHEN nfl_plays.bc_pid IS NOT NULL OR nfl_plays.trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2)`,
    numerator_select: `COUNT(CASE WHEN nfl_plays.bc_pid = pg.pid THEN 1 ELSE NULL END) + COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)`,
    denominator_select: `SUM(CASE WHEN nfl_plays.bc_pid IS NOT NULL OR nfl_plays.trg_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  player_fumble_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN player_fuml_pid = bc_pid THEN 1 ELSE 0 END) / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'fumble_pct_from_plays',
    numerator_select: `SUM(CASE WHEN player_fuml_pid = bc_pid THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_positive_rush_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END) / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'positive_rush_pct_from_plays',
    numerator_select: `SUM(CASE WHEN rush_yds > 0 THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_successful_rush_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN succ = true THEN 1 ELSE 0 END) / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'succ_rush_pct_from_plays',
    numerator_select: `SUM(CASE WHEN succ = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_broken_tackles_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'], // TODO should include bc_pid and trg_pid
    with_select_string: `SUM(mbt)`,
    stat_name: 'broken_tackles_from_plays'
  }),
  player_broken_tackles_per_rush_attempt_from_plays: player_stat_from_plays({
    pid_columns: ['bc_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(mbt)::decimal / SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'broken_tackles_per_rush_att_from_plays',
    numerator_select: `SUM(mbt)`,
    denominator_select: `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_receptions_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    stat_name: 'recs_from_plays'
  }),
  player_receiving_yards_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)`,
    stat_name: 'rec_yds_from_plays'
  }),
  player_receiving_touchdowns_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN comp = true AND td = true THEN 1 ELSE 0 END)`,
    stat_name: 'rec_tds_from_plays'
  }),
  player_drops_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN dropped_pass = true THEN 1 ELSE 0 END)`,
    stat_name: 'drops_from_plays'
  }),
  player_dropped_receiving_yards_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN dropped_pass = true THEN dot ELSE 0 END)`,
    stat_name: 'drop_rec_yds_from_plays'
  }),
  player_targets_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    stat_name: 'trg_from_plays'
  }),
  player_deep_targets_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END)`,
    stat_name: 'deep_trg_from_plays'
  }),
  player_deep_targets_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END) / SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'deep_trg_pct_from_plays',
    numerator_select: `SUM(CASE WHEN dot >= 20 THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_air_yards_per_target_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(dot)::decimal / SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'air_yds_per_trg_from_plays',
    numerator_select: `SUM(dot)`,
    denominator_select: `SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_air_yards_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(dot)`,
    stat_name: 'air_yds_from_plays'
  }),
  player_receiving_first_down_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `SUM(CASE WHEN first_down = true THEN 1 ELSE 0 END)`,
    stat_name: 'recv_first_down_from_plays'
  }),
  player_receiving_first_down_percentage_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN first_down = true THEN 1 ELSE 0 END) / SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 2) ELSE 0 END`,
    stat_name: 'recv_first_down_pct_from_plays',
    numerator_select: `SUM(CASE WHEN first_down = true THEN 1 ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  player_air_yards_share_from_plays: create_team_share_stat({
    column_name: 'air_yds_share_from_plays',
    pid_columns: ['trg_pid'],
    with_select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / SUM(nfl_plays.dot), 2)'
  }),
  player_target_share_from_plays: create_team_share_stat({
    column_name: 'trg_share_from_plays',
    pid_columns: ['trg_pid'],
    with_select_string:
      'ROUND(100.0 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0), 2)',
    numerator_select: `COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END)`,
    denominator_select: `SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_weighted_opportunity_rating_from_plays: create_team_share_stat({
    column_name: 'weighted_opp_rating_from_plays',
    pid_columns: ['trg_pid'],
    with_select_string:
      'ROUND((1.5 * COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) / NULLIF(SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END), 0)) + (0.7 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) / NULLIF(SUM(nfl_plays.dot), 0)), 4)',
    with_select_string_year_offset_range:
      'COUNT(CASE WHEN nfl_plays.trg_pid = pg.pid THEN 1 ELSE NULL END) as player_targets, SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END) as team_targets, SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN nfl_plays.dot ELSE 0 END) as player_air_yards, SUM(nfl_plays.dot) as team_air_yards',
    main_select_string_year_offset_range: ({ table_name, params }) =>
      `(SELECT ROUND((1.5 * SUM(${table_name}.player_targets) / NULLIF(SUM(${table_name}.team_targets), 0)) + (0.7 * SUM(${table_name}.player_air_yards) / NULLIF(SUM(${table_name}.team_air_yards), 0)), 4) FROM ${table_name} WHERE ${table_name}.pid = player.pid AND ${table_name}.year BETWEEN player_years.year + ${Math.min(...params.year_offset)} AND player_years.year + ${Math.max(...params.year_offset)})`
  }),
  player_receiving_first_down_share_from_plays: create_team_share_stat({
    column_name: 'recv_first_down_share_from_plays',
    pid_columns: ['trg_pid'],
    with_select_string:
      'ROUND(100.0 * SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END ELSE 0 END) / NULLIF(SUM(CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END), 0), 2)',
    numerator_select: `SUM(CASE WHEN nfl_plays.trg_pid = pg.pid THEN CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN nfl_plays.first_down THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),

  // receiving yards / air yards
  player_receiver_air_conversion_ratio_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN ROUND(100.0 * SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END) / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 4) ELSE 0 END`,
    stat_name: 'rec_air_conv_ratio_from_plays',
    numerator_select: `SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_receiving_yards_per_reception_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)::decimal / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'rec_yds_per_rec_from_plays',
    numerator_select: `SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_receiving_yards_per_target_from_plays: player_stat_from_plays({
    pid_columns: ['trg_pid'],
    with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)::decimal / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
    stat_name: 'rec_yds_per_trg_from_plays',
    numerator_select: `SUM(CASE WHEN comp = true THEN recv_yds ELSE 0 END)`,
    denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    has_numerator_denominator: true
  }),
  player_receiving_yards_after_catch_per_reception_from_plays:
    player_stat_from_plays({
      pid_columns: ['trg_pid'],
      with_select_string: `CASE WHEN SUM(CASE WHEN comp = true THEN 1 ELSE 0 END) > 0 THEN CAST(ROUND(SUM(CASE WHEN comp = true THEN yards_after_catch ELSE 0 END)::decimal / SUM(CASE WHEN comp = true THEN 1 ELSE 0 END), 2) AS decimal) ELSE 0 END`,
      stat_name: 'rec_yds_after_catch_per_rec_from_plays',
      numerator_select: `SUM(CASE WHEN comp = true THEN yards_after_catch ELSE 0 END)`,
      denominator_select: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
      has_numerator_denominator: true
    })
}
