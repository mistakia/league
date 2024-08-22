import db from '#db'

export default {
  player_name: {
    table_name: 'player',
    main_where: ({ case_insensitive = false }) => {
      if (case_insensitive) {
        return db.raw(`UPPER(player.fname || ' ' || player.lname)`)
      } else {
        return db.raw(`player.fname || ' ' || player.lname`)
      }
    },
    main_select: () => ['player.fname', 'player.lname'],
    main_group_by: () => ['player.fname', 'player.lname']
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
  player_body_mass_index: {
    table_name: 'player',
    column_name: 'bmi',
    main_select: ({ column_index }) => [
      db.raw(
        `CASE WHEN player.height > 0 THEN ROUND(CAST((player.weight::float / NULLIF(player.height::float * player.height::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END as bmi_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `CASE WHEN player.height > 0 THEN ROUND(CAST((player.weight::float / NULLIF(player.height::float * player.height::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END`
      ),
    main_group_by: () => ['player.weight', 'player.height'],
    use_having: true
  },
  player_speed_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `CASE WHEN player.forty > 0 THEN ROUND((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0), 2) ELSE NULL END as speed_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `CASE WHEN player.forty > 0 THEN ROUND((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0), 2) ELSE NULL END`
      ),
    main_group_by: () => ['player.weight', 'player.forty'],
    use_having: true
  },
  player_height_adjusted_speed_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `CASE WHEN player.pos IN ('WR', 'TE') AND player.forty > 0 THEN ROUND(((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0)) * (player.height / CASE WHEN player.pos = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END as height_adjusted_speed_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `CASE WHEN player.pos IN ('WR', 'TE') AND player.forty > 0 THEN ROUND(((player.weight * 200.0) / NULLIF(POWER(player.forty, 4), 0)) * (player.height / CASE WHEN player.pos = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END`
      ),
    main_group_by: () => [
      'player.weight',
      'player.forty',
      'player.height',
      'player.pos'
    ],
    use_having: true
  },
  player_agility_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `ROUND(COALESCE(player.shuttle, 0) + COALESCE(player.cone, 0), 2) as agility_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        'ROUND(COALESCE(player.shuttle, 0) + COALESCE(player.cone, 0), 2)'
      ),
    main_group_by: () => ['player.shuttle', 'player.cone'],
    use_having: true
  },
  player_burst_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2) as burst_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2)`
      ),
    main_group_by: () => ['player.vertical', 'player.broad'],
    use_having: true
  },
  player_age: {
    table_alias: ({ splits }) => {
      if (splits.includes('year')) {
        return 'year_splits_player_age'
      }

      return 'player'
    },
    column_name: 'age',
    year_select: () => undefined,
    join: ({
      query,
      splits,
      join_type,
      year_split_join_clause,
      data_view_options
    }) => {
      if (!splits.includes('year')) {
        return
      }

      if (data_view_options.opening_days_joined) {
        return
      }

      query.leftJoin('opening_days', 'opening_days.year', 'player_years.year')
      data_view_options.opening_days_joined = true
    },
    main_select: ({ column_index, splits }) => {
      const base_year = splits.includes('year')
        ? 'opening_days.opening_day'
        : 'CURRENT_DATE'
      return [
        db.raw(
          `CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(${base_year}, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(${base_year}, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(${base_year}, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END as age_${column_index}`
        )
      ]
    },
    main_group_by: ({ splits }) =>
      splits.includes('year')
        ? ['player.dob', 'opening_days.opening_day']
        : ['player.dob'],
    main_where: ({ splits = [] } = {}) => {
      const base_year = splits.includes('year')
        ? 'opening_days.opening_day'
        : 'CURRENT_DATE'
      return db.raw(
        `CASE WHEN player.dob IS NULL OR player.dob = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(${base_year}, TO_DATE(player.dob, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(${base_year}, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(${base_year}, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) END`
      )
    },
    use_having: true,
    supported_splits: ['year']
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
  player_ngs_athleticism_score: {
    table_name: 'player',
    column_name: 'ngs_athleticism_score'
  },
  player_ngs_draft_grade: {
    table_name: 'player',
    column_name: 'ngs_draft_grade'
  },
  player_nfl_grade: {
    table_name: 'player',
    column_name: 'nfl_grade'
  },
  player_ngs_production_score: {
    table_name: 'player',
    column_name: 'ngs_production_score'
  },
  player_ngs_size_score: {
    table_name: 'player',
    column_name: 'ngs_size_score'
  },

  player_nflid: {
    table_name: 'player',
    column_name: 'nflid'
  },
  player_esbid: {
    table_name: 'player',
    column_name: 'esbid'
  },
  player_gsisid: {
    table_name: 'player',
    column_name: 'gsisid'
  },
  player_gsispid: {
    table_name: 'player',
    column_name: 'gsispid'
  },
  player_gsis_it_id: {
    table_name: 'player',
    column_name: 'gsisItId'
  },
  player_sleeper_id: {
    table_name: 'player',
    column_name: 'sleeper_id'
  },
  player_rotoworld_id: {
    table_name: 'player',
    column_name: 'rotoworld_id'
  },
  player_rotowire_id: {
    table_name: 'player',
    column_name: 'rotowire_id'
  },
  player_sportradar_id: {
    table_name: 'player',
    column_name: 'sportradar_id'
  },
  player_espn_id: {
    table_name: 'player',
    column_name: 'espn_id'
  },
  player_fantasy_data_id: {
    table_name: 'player',
    column_name: 'fantasy_data_id'
  },
  player_yahoo_id: {
    table_name: 'player',
    column_name: 'yahoo_id'
  },
  player_keeptradecut_id: {
    table_name: 'player',
    column_name: 'keeptradecut_id'
  },
  player_pfr_id: {
    table_name: 'player',
    column_name: 'pfr_id'
  },
  player_otc_id: {
    table_name: 'player',
    column_name: 'otc_id'
  },
  player_contract_year_signed: {
    table_name: 'player',
    column_name: 'contract_year_signed'
  },
  player_contract_years: {
    table_name: 'player',
    column_name: 'contract_years'
  },
  player_contract_value: {
    table_name: 'player',
    column_name: 'contract_value'
  },
  player_contract_apy: {
    table_name: 'player',
    column_name: 'contract_apy'
  },
  player_contract_guaranteed: {
    table_name: 'player',
    column_name: 'contract_guaranteed'
  },
  player_contract_apy_cap_pct: {
    table_name: 'player',
    column_name: 'contract_apy_cap_pct'
  },
  player_contract_inflated_value: {
    table_name: 'player',
    column_name: 'contract_inflated_value'
  },
  player_contract_inflated_apy: {
    table_name: 'player',
    column_name: 'contract_inflated_apy'
  },
  player_contract_inflated_guaranteed: {
    table_name: 'player',
    column_name: 'contract_inflated_guaranteed'
  }
  // TODO player.dcp ??
}
