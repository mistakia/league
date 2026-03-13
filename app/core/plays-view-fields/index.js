import * as table_constants from 'react-table/src/constants.mjs'

import { plays_view_fields_index, nfl_plays_column_params } from '@libs-shared'

const PLAYS_COLUMN_GROUPS = {
  CORE: { column_group_id: 'CORE', priority: 1 },
  OUTCOME: { column_group_id: 'OUTCOME', priority: 2 },
  PASSING: { column_group_id: 'PASSING', priority: 3 },
  RUSHING: { column_group_id: 'RUSHING', priority: 3 },
  RECEIVING: { column_group_id: 'RECEIVING', priority: 3 },
  CONTEXT: { column_group_id: 'CONTEXT', priority: 4 },
  PERSONNEL: { column_group_id: 'PERSONNEL', priority: 4 },
  SITUATIONAL: { column_group_id: 'SITUATIONAL', priority: 5 }
}

const play_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  size: 70,
  ...field
})

const play_text_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.TEXT,
  size: 100,
  ...field
})

const play_boolean_field = (field) => ({
  data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
  size: 60,
  ...field
})

const plays_view_fields = {
  // Core play fields
  play_esbid: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'ESBID',
    size: 90
  }),
  play_timestamp: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'TIME',
    size: 70
  }),
  play_game_timestamp: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'GTIME',
    size: 90
  }),
  play_desc: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'DESC',
    size: 300
  }),
  play_type: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'TYPE',
    size: 60,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    column_values: [
      'PASS',
      'RUSH',
      'PUNT',
      'KICK',
      'FGXP',
      'NOPL',
      'KOFF',
      'ONSD',
      'CONV'
    ]
  }),
  play_off_team: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'OFF',
    size: 50
  }),
  play_def_team: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'DEF',
    size: 50
  }),
  play_down: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'DWN',
    size: 40
  }),
  play_yards_to_go: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'YTG',
    size: 40
  }),
  play_ydl_100: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'YDL',
    size: 40
  }),
  play_quarter: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'QTR',
    size: 40
  }),
  play_game_clock: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'CLOCK',
    size: 60
  }),
  play_sequence: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'SEQ',
    size: 50
  }),
  play_year: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'YEAR',
    size: 60,
    column_params: nfl_plays_column_params
  }),
  play_week: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'WK',
    size: 40,
    column_params: nfl_plays_column_params
  }),
  play_game_id: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CORE],
    header_label: 'GID',
    size: 80
  }),

  // Outcome fields
  play_yds_gained: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'YDS'
  }),
  play_yds_gained_avg: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'AVG',
    fixed: 1
  }),
  play_first_down: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: '1D'
  }),
  play_td: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'TD'
  }),
  play_successful: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'SUCC'
  }),
  play_epa: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'EPA',
    fixed: 2
  }),
  play_epa_total: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'EPA TOT',
    fixed: 1,
    size: 80
  }),
  play_wpa: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'WPA',
    fixed: 3
  }),
  play_ep: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'EP',
    fixed: 2
  }),
  play_wp: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'WP',
    fixed: 3
  }),
  play_cpoe: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'CPOE',
    fixed: 1
  }),
  play_xpass_prob: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'XPASS',
    fixed: 2,
    size: 60
  }),
  play_pass_oe: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.OUTCOME],
    header_label: 'POE',
    fixed: 2
  }),

  // Passing fields
  play_passer: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'PASSER',
    size: 120
  }),
  play_passer_pid: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'PSR PID',
    size: 80
  }),
  play_pass_yds: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'PYD'
  }),
  play_air_yards: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'AY'
  }),
  play_true_air_yards: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'TAY'
  }),
  play_comp: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'CMP'
  }),
  play_time_to_throw: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'TTT',
    fixed: 2
  }),
  play_dot: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'DOT',
    fixed: 1
  }),
  play_highlight_pass: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'BT'
  }),
  play_int_worthy: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'IW'
  }),
  play_dropped_pass: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'DRP'
  }),
  play_qb_pressure: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'PRSS'
  }),
  play_qb_hit: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'HIT'
  }),
  play_sk: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PASSING],
    header_label: 'SK'
  }),

  // Rushing fields
  play_rusher: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'RUSHER',
    size: 120
  }),
  play_rusher_pid: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'RB PID',
    size: 80
  }),
  play_rush_yds: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'RYD'
  }),
  play_yards_after_contact: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'YAC',
    fixed: 1
  }),
  play_broken_tackles: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'BT'
  }),
  play_run_location: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'LOC',
    size: 70,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    column_values: ['left', 'middle', 'right']
  }),
  play_run_gap: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RUSHING],
    header_label: 'GAP',
    size: 70,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    column_values: ['guard', 'tackle', 'end']
  }),

  // Receiving fields
  play_target: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'TARGET',
    size: 120
  }),
  play_target_pid: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'TGT PID',
    size: 80
  }),
  play_recv_yds: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'RECY'
  }),
  play_yards_after_catch: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'YAC',
    fixed: 1
  }),
  play_route: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'ROUTE',
    size: 80
  }),
  play_contested_ball: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'CNTST'
  }),
  play_catchable_ball: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'CTCH'
  }),
  play_endzone_target: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.RECEIVING],
    header_label: 'EZ'
  }),

  // Context fields
  play_score_diff: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'SDIFF'
  }),
  play_home_score: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'HSCR'
  }),
  play_away_score: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'ASCR'
  }),
  play_sec_rem_half: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'SRH',
    size: 60
  }),
  play_sec_rem_gm: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'SRG',
    size: 60
  }),
  play_home_team: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'HOME',
    size: 55
  }),
  play_away_team: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'AWAY',
    size: 55
  }),
  play_goal_to_go: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.CONTEXT],
    header_label: 'GTG'
  }),

  // Personnel fields
  play_off_formation: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PERSONNEL],
    header_label: 'FORM',
    size: 130,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    column_values: [
      'SHOTGUN',
      'UNDER_CENTER',
      'PISTOL',
      'EMPTY',
      'WILDCAT',
      'JUMBO',
      'I_FORM',
      'SINGLEBACK'
    ]
  }),
  play_off_personnel: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PERSONNEL],
    header_label: 'O PERS',
    size: 100
  }),
  play_def_personnel: play_text_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PERSONNEL],
    header_label: 'D PERS',
    size: 100
  }),
  play_box_defenders: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PERSONNEL],
    header_label: 'BOX',
    fixed: 1
  }),
  play_pass_rushers: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PERSONNEL],
    header_label: 'RUSH',
    fixed: 1
  }),
  play_blitzers: play_field({
    column_groups: [PLAYS_COLUMN_GROUPS.PERSONNEL],
    header_label: 'BLTZ',
    fixed: 1
  }),

  // Situational fields
  play_is_play_action: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'PA'
  }),
  play_is_no_huddle: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'NHUD'
  }),
  play_is_screen: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'SCRN'
  }),
  play_is_qb_scramble: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'SCMB'
  }),
  play_is_qb_rush: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'QBR'
  }),
  play_is_blitz: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'BLZ'
  }),
  play_is_zero_blitz: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: '0BLZ'
  }),
  play_is_motion: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'MOT'
  }),
  play_is_trick_play: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'TRCK'
  }),
  play_is_out_of_pocket: play_boolean_field({
    column_groups: [PLAYS_COLUMN_GROUPS.SITUATIONAL],
    header_label: 'OOP'
  })
}

// Add column_id, accessorKey, and description from shared index
for (const [key, value] of Object.entries(plays_view_fields)) {
  value.column_id = key
  value.accessorKey = key
  value.description = plays_view_fields_index[key] || null
}

export default plays_view_fields
