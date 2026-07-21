import db from '#db'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const player_table_get_cache_info = create_static_cache_info()

export default {
  player_name: {
    table_name: 'player',
    main_where: ({ case_insensitive = false }) => {
      if (case_insensitive) {
        return db.raw(`UPPER(player.first_name || ' ' || player.last_name)`)
      } else {
        return db.raw(`player.first_name || ' ' || player.last_name`)
      }
    },
    main_select: () => ['player.first_name', 'player.last_name'],
    main_group_by: () => ['player.first_name', 'player.last_name'],
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_position: {
    table_name: 'player',
    column_name: 'primary_position',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },

  player_height: {
    table_name: 'player',
    column_name: 'height_inches',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_weight: {
    table_name: 'player',
    column_name: 'weight_pounds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_body_mass_index: {
    table_name: 'player',
    column_name: 'bmi',
    main_select: ({ column_index }) => [
      db.raw(
        `CASE WHEN player.height_inches > 0 THEN ROUND(CAST((player.weight_pounds::float / NULLIF(player.height_inches::float * player.height_inches::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END as bmi_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `CASE WHEN player.height_inches > 0 THEN ROUND(CAST((player.weight_pounds::float / NULLIF(player.height_inches::float * player.height_inches::float, 0)) * 703 AS NUMERIC), 2) ELSE NULL END`
      ),
    main_group_by: () => ['player.weight_pounds', 'player.height_inches'],
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_speed_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `CASE WHEN player.forty_yard_dash_seconds > 0 THEN ROUND((player.weight_pounds * 200.0) / NULLIF(POWER(player.forty_yard_dash_seconds, 4), 0), 2) ELSE NULL END as speed_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `CASE WHEN player.forty_yard_dash_seconds > 0 THEN ROUND((player.weight_pounds * 200.0) / NULLIF(POWER(player.forty_yard_dash_seconds, 4), 0), 2) ELSE NULL END`
      ),
    main_group_by: () => [
      'player.weight_pounds',
      'player.forty_yard_dash_seconds'
    ],
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_height_adjusted_speed_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `CASE WHEN player.primary_position IN ('WR', 'TE') AND player.forty_yard_dash_seconds > 0 THEN ROUND(((player.weight_pounds * 200.0) / NULLIF(POWER(player.forty_yard_dash_seconds, 4), 0)) * (player.height_inches / CASE WHEN player.primary_position = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END as height_adjusted_speed_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        `CASE WHEN player.primary_position IN ('WR', 'TE') AND player.forty_yard_dash_seconds > 0 THEN ROUND(((player.weight_pounds * 200.0) / NULLIF(POWER(player.forty_yard_dash_seconds, 4), 0)) * (player.height_inches / CASE WHEN player.primary_position = 'TE' THEN 76.4 ELSE 73.0 END), 2) ELSE NULL END`
      ),
    main_group_by: () => [
      'player.weight_pounds',
      'player.forty_yard_dash_seconds',
      'player.height_inches',
      'player.primary_position'
    ],
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_agility_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `ROUND(COALESCE(player.shuttle_run_seconds, 0) + COALESCE(player.three_cone_drill_seconds, 0), 2) as agility_score_${column_index}`
      )
    ],
    main_where: () =>
      db.raw(
        'ROUND(COALESCE(player.shuttle_run_seconds, 0) + COALESCE(player.three_cone_drill_seconds, 0), 2)'
      ),
    main_group_by: () => [
      'player.shuttle_run_seconds',
      'player.three_cone_drill_seconds'
    ],
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_burst_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `ROUND(COALESCE(player.vertical_jump_inches, 0) + (COALESCE(player.broad_jump_inches, 0) / 12.0), 2) as burst_score_${column_index}`
      )
    ],
    sort_column_name: 'burst_score',
    main_where: () =>
      db.raw(
        `ROUND(COALESCE(player.vertical_jump_inches, 0) + (COALESCE(player.broad_jump_inches, 0) / 12.0), 2)`
      ),
    main_group_by: () => [
      'player.vertical_jump_inches',
      'player.broad_jump_inches'
    ],
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_age: {
    // TODO career_year
    table_alias: ({ row_axes }) => {
      if (row_axes.includes('year')) {
        return 'year_splits_player_age'
      }

      return 'player'
    },
    column_name: 'age',
    year_select: () => undefined,
    join: ({ query, row_axes, join_type, data_view_options }) => {
      if (!row_axes.includes('year')) {
        return
      }

      if (data_view_options.opening_days_joined) {
        return
      }

      query.leftJoin(
        'opening_days',
        'opening_days.year',
        data_view_options.year_reference
      )
      data_view_options.opening_days_joined = true
    },
    main_select: ({ column_index, row_axes }) => {
      const base_year = row_axes.includes('year')
        ? 'opening_days.opening_day'
        : 'CURRENT_DATE'
      return [
        db.raw(
          `CASE WHEN player.date_of_birth IS NULL OR player.date_of_birth = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(${base_year}, TO_DATE(player.date_of_birth, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(${base_year}, TO_DATE(player.date_of_birth, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(${base_year}, TO_DATE(player.date_of_birth, 'YYYY-MM-DD'))) / 365.25), 2) END as age_${column_index}`
        )
      ]
    },
    main_group_by: ({ row_axes }) =>
      row_axes.includes('year')
        ? ['player.date_of_birth', 'opening_days.opening_day']
        : ['player.date_of_birth'],
    main_where: ({ row_axes = [] } = {}) => {
      const base_year = row_axes.includes('year')
        ? 'opening_days.opening_day'
        : 'CURRENT_DATE'
      return db.raw(
        `CASE WHEN player.date_of_birth IS NULL OR player.date_of_birth = '0000-00-00' THEN NULL ELSE ROUND(EXTRACT(YEAR FROM AGE(${base_year}, TO_DATE(player.date_of_birth, 'YYYY-MM-DD'))) + (EXTRACT(MONTH FROM AGE(${base_year}, TO_DATE(player.date_of_birth, 'YYYY-MM-DD'))) / 12.0) + (EXTRACT(DAY FROM AGE(${base_year}, TO_DATE(player.date_of_birth, 'YYYY-MM-DD'))) / 365.25), 2) END`
      )
    },
    use_having: true,
    source: { grain: 'player_year' },
    get_cache_info: player_table_get_cache_info
  },
  player_date_of_birth: {
    table_name: 'player',
    column_name: 'date_of_birth',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_forty_yard_dash: {
    table_name: 'player',
    column_name: 'forty_yard_dash_seconds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_forty_yard_dash_designation: {
    table_name: 'player',
    column_name: 'forty_yard_dash_designation',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ten_yard_split: {
    table_name: 'player',
    column_name: 'ten_yard_split_seconds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ten_yard_split_designation: {
    table_name: 'player',
    column_name: 'ten_yard_split_designation',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pro_forty_yard_dash: {
    table_name: 'player',
    column_name: 'pro_day_forty_seconds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pro_forty_yard_dash_designation: {
    table_name: 'player',
    column_name: 'pro_day_forty_designation',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sixty_yard_shuttle: {
    table_name: 'player',
    column_name: 'sixty_yard_shuttle_seconds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sixty_yard_shuttle_designation: {
    table_name: 'player',
    column_name: 'sixty_yard_shuttle_designation',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_combine_attendance: {
    table_name: 'player',
    column_name: 'combine_attendance',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_hometown: {
    table_name: 'player',
    column_name: 'hometown',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_bench_press: {
    table_name: 'player',
    column_name: 'bench_press_reps',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_vertical_jump: {
    table_name: 'player',
    column_name: 'vertical_jump_inches',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_broad_jump: {
    table_name: 'player',
    column_name: 'broad_jump_inches',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_shuttle_run: {
    table_name: 'player',
    column_name: 'shuttle_run_seconds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_three_cone_drill: {
    table_name: 'player',
    column_name: 'three_cone_drill_seconds',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_arm_length: {
    table_name: 'player',
    column_name: 'arm_length_inches',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_hand_size: {
    table_name: 'player',
    column_name: 'hand_size_inches',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_draft_position: {
    table_name: 'player',
    column_name: 'draft_overall_pick',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_draft_round: {
    table_name: 'player',
    column_name: 'draft_round',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_college: {
    table_name: 'player',
    column_name: 'college',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_college_division: {
    table_name: 'player',
    column_name: 'college_division',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_starting_nfl_year: {
    table_name: 'player',
    column_name: 'nfl_draft_year',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_current_nfl_team: {
    table_name: 'player',
    column_name: 'current_nfl_team',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_position_depth: {
    table_name: 'player',
    column_name: 'position_depth',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_jersey_number: {
    table_name: 'player',
    column_name: 'jersey_number',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ngs_athleticism_score: {
    table_name: 'player',
    column_name: 'ngs_athleticism_score',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ngs_draft_grade: {
    table_name: 'player',
    column_name: 'ngs_draft_grade',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_nfl_grade: {
    table_name: 'player',
    column_name: 'nfl_grade',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ngs_production_score: {
    table_name: 'player',
    column_name: 'ngs_production_score',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ngs_size_score: {
    table_name: 'player',
    column_name: 'ngs_size_score',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },

  player_nfl_id: {
    table_name: 'player',
    column_name: 'nfl_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_esbid: {
    table_name: 'player',
    column_name: 'esb_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_gsisid: {
    table_name: 'player',
    column_name: 'gsis_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_gsispid: {
    table_name: 'player',
    column_name: 'smart_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_gsis_it_id: {
    table_name: 'player',
    column_name: 'gsis_it_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sleeper_id: {
    table_name: 'player',
    column_name: 'sleeper_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_rotoworld_id: {
    table_name: 'player',
    column_name: 'rotoworld_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_rotowire_id: {
    table_name: 'player',
    column_name: 'rotowire_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sportradar_id: {
    table_name: 'player',
    column_name: 'sportradar_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_espn_id: {
    table_name: 'player',
    column_name: 'espn_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_fantasy_data_id: {
    table_name: 'player',
    column_name: 'fantasy_data_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_yahoo_id: {
    table_name: 'player',
    column_name: 'yahoo_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_keeptradecut_id: {
    table_name: 'player',
    column_name: 'keeptradecut_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pfr_id: {
    table_name: 'player',
    column_name: 'pfr_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_otc_id: {
    table_name: 'player',
    column_name: 'otc_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_draftkings_id: {
    table_name: 'player',
    column_name: 'draftkings_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pff_id: {
    table_name: 'player',
    column_name: 'pff_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_mfl_id: {
    table_name: 'player',
    column_name: 'mfl_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_fleaflicker_id: {
    table_name: 'player',
    column_name: 'fleaflicker_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_cbs_id: {
    table_name: 'player',
    column_name: 'cbs_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_cfbref_id: {
    table_name: 'player',
    column_name: 'cfbref_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_twitter_username: {
    table_name: 'player',
    column_name: 'twitter_username',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_swish_id: {
    table_name: 'player',
    column_name: 'swish_player_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },

  player_contract_year_signed: {
    table_name: 'player',
    column_name: 'contract_year_signed',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_years: {
    table_name: 'player',
    column_name: 'contract_years',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_value: {
    table_name: 'player',
    column_name: 'contract_value',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_apy: {
    table_name: 'player',
    column_name: 'contract_apy',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_guaranteed: {
    table_name: 'player',
    column_name: 'contract_guaranteed',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_apy_cap_pct: {
    table_name: 'player',
    column_name: 'contract_apy_cap_pct',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_inflated_value: {
    table_name: 'player',
    column_name: 'contract_inflated_value',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_inflated_apy: {
    table_name: 'player',
    column_name: 'contract_inflated_apy',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_contract_inflated_guaranteed: {
    table_name: 'player',
    column_name: 'contract_inflated_guaranteed',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },

  player_all_pro_first_team_selections: {
    table_name: 'player',
    column_name: 'all_pro_first_team_selections',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pro_bowl_selections: {
    table_name: 'player',
    column_name: 'pro_bowl_selections',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pfr_years_as_primary_starter: {
    table_name: 'player',
    column_name: 'pfr_years_as_primary_starter',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pfr_weighted_career_approximate_value: {
    table_name: 'player',
    column_name: 'pfr_weighted_career_approximate_value',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pfr_weighted_career_approximate_value_drafted_team: {
    table_name: 'player',
    column_name: 'pfr_weighted_career_approximate_value_drafted_team',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  }
  // TODO player.draft_capital_points ??
}
