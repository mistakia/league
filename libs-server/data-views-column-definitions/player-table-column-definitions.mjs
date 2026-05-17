import db from '#db'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const player_table_get_cache_info = create_static_cache_info()

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
    main_group_by: () => ['player.fname', 'player.lname'],
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_position: {
    table_name: 'player',
    column_name: 'pos',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },

  player_height: {
    table_name: 'player',
    column_name: 'height',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_weight: {
    table_name: 'player',
    column_name: 'weight',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
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
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
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
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
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
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
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
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_burst_score: {
    table_name: 'player',
    main_select: ({ column_index }) => [
      db.raw(
        `ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2) as burst_score_${column_index}`
      )
    ],
    sort_column_name: 'burst_score',
    main_where: () =>
      db.raw(
        `ROUND(COALESCE(player.vertical, 0) + (COALESCE(player.broad, 0) / 12.0), 2)`
      ),
    main_group_by: () => ['player.vertical', 'player.broad'],
    use_having: true,
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_age: {
    // TODO career_year
    table_alias: ({ splits }) => {
      if (splits.includes('year')) {
        return 'year_splits_player_age'
      }

      return 'player'
    },
    column_name: 'age',
    year_select: () => undefined,
    join: ({ query, splits, join_type, data_view_options }) => {
      if (!splits.includes('year')) {
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
    source: { grain: 'player_year' },
    get_cache_info: player_table_get_cache_info
  },
  player_date_of_birth: {
    table_name: 'player',
    column_name: 'dob',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_forty_yard_dash: {
    table_name: 'player',
    column_name: 'forty',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_forty_yard_dash_designation: {
    table_name: 'player',
    column_name: 'forty_designation',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_ten_yard_split: {
    table_name: 'player',
    column_name: 'ten_yard_split',
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
    column_name: 'pro_forty',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pro_forty_yard_dash_designation: {
    table_name: 'player',
    column_name: 'pro_forty_designation',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sixty_yard_shuttle: {
    table_name: 'player',
    column_name: 'sixty_yard_shuttle',
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
    column_name: 'bench',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_vertical_jump: {
    table_name: 'player',
    column_name: 'vertical',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_broad_jump: {
    table_name: 'player',
    column_name: 'broad',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_shuttle_run: {
    table_name: 'player',
    column_name: 'shuttle',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_three_cone_drill: {
    table_name: 'player',
    column_name: 'cone',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_arm_length: {
    table_name: 'player',
    column_name: 'arm',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_hand_size: {
    table_name: 'player',
    column_name: 'hand',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_draft_position: {
    table_name: 'player',
    column_name: 'dpos',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_draft_round: {
    table_name: 'player',
    column_name: 'round',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_college: {
    table_name: 'player',
    column_name: 'col',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_college_division: {
    table_name: 'player',
    column_name: 'dv',
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
    column_name: 'posd',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_jersey_number: {
    table_name: 'player',
    column_name: 'jnum',
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
    column_name: 'nfl_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_esbid: {
    table_name: 'player',
    column_name: 'esbid',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_gsisid: {
    table_name: 'player',
    column_name: 'gsisid',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_gsispid: {
    table_name: 'player',
    column_name: 'gsispid',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_gsis_it_id: {
    table_name: 'player',
    column_name: 'gsis_it_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sleeper_id: {
    table_name: 'player',
    column_name: 'sleeper_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_rotoworld_id: {
    table_name: 'player',
    column_name: 'rotoworld_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_rotowire_id: {
    table_name: 'player',
    column_name: 'rotowire_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_sportradar_id: {
    table_name: 'player',
    column_name: 'sportradar_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_espn_id: {
    table_name: 'player',
    column_name: 'espn_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_fantasy_data_id: {
    table_name: 'player',
    column_name: 'fantasy_data_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_yahoo_id: {
    table_name: 'player',
    column_name: 'yahoo_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_keeptradecut_id: {
    table_name: 'player',
    column_name: 'keeptradecut_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pfr_id: {
    table_name: 'player',
    column_name: 'pfr_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_otc_id: {
    table_name: 'player',
    column_name: 'otc_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_draftkings_id: {
    table_name: 'player',
    column_name: 'draftkings_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_pff_id: {
    table_name: 'player',
    column_name: 'pff_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_mfl_id: {
    table_name: 'player',
    column_name: 'mfl_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_fleaflicker_id: {
    table_name: 'player',
    column_name: 'fleaflicker_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_cbs_id: {
    table_name: 'player',
    column_name: 'cbs_id',
    source: { grain: 'player' },
    get_cache_info: player_table_get_cache_info
  },
  player_cfbref_id: {
    table_name: 'player',
    column_name: 'cfbref_id',
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
    column_name: 'swish_id',
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
  // TODO player.dcp ??
}
