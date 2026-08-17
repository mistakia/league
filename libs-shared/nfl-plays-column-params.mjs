import * as table_constants from 'react-table/src/constants.mjs'
import {
  nfl_downs,
  nfl_quarters,
  nfl_team_abbreviations,
  build_nfl_team_values,
  nfl_team_value_groups
} from '#constants'
import { COLUMN_PARAM_GROUPS } from './column-param-groups.mjs'
import {
  career_year,
  career_game,
  year_offset,
  nfl_week_id
} from './common-column-params.mjs'

const nfl_team_param_values = build_nfl_team_values()

const score_diff_preset_values = [
  {
    label: 'Leading',
    values: [1, 70]
  },
  {
    label: 'Trailing',
    values: [-70, -1]
  },
  {
    label: 'Tied',
    values: [0, 0]
  },
  {
    label: 'One Score Game',
    values: [-8, 8]
  },
  {
    label: 'Two Score Game',
    values: [-16, 16]
  },
  {
    label: 'Close Game',
    values: [-7, 7]
  },
  {
    label: 'Blowout (Leading)',
    values: [17, 70]
  },
  {
    label: 'Blowout (Trailing)',
    values: [-70, -17]
  },
  {
    label: 'Garbage Time (Leading)',
    values: [22, 70]
  },
  {
    label: 'Garbage Time (Trailing)',
    values: [-70, -22]
  }
]

export const nfl_games_params = {
  roof: {
    values: ['dome', 'outdoors', 'closed', 'open'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  playing_surface: {
    values: [
      'grass',
      'astroturf',
      'fieldturf',
      'dessograss',
      'astroplay',
      'matrixturf',
      'sportturf',
      'a_turf'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  wind_speed_mph: {
    label: 'Wind',
    show_key_in_short: true,
    min: 0,
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WEATHER]
  },
  temperature_fahrenheit: {
    label: 'Temp',
    show_key_in_short: true,
    min: -30,
    max: 109,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WEATHER]
  },
  referee: {
    values: [
      'Adrian Hall',
      'Adrian Hill',
      'Al Hynes',
      'Al Riveron',
      'Alan Eck',
      'Alberto Riveron',
      'Alex Kemp',
      'Aster Sizemore',
      'Bernie Kukar',
      'Bill Athan',
      'Bill Blum',
      'Bill Carollo',
      'Bill Carolo',
      'Bill Etzler',
      'Bill Leavy',
      'Bill Vinocich',
      'Bill Vinovich',
      'Billy Leavy',
      'Bob McElwee',
      'Brad Allen',
      'Brad Rogers',
      'Bradley Rogers',
      'Bruce Hermansen',
      'Carl Cheffers',
      'Clay Martin',
      'Clete Blakeman',
      'Craig Wrolstad',
      'David Scott',
      'David White',
      'Dick Hantag',
      'Dick Hantak',
      'Don Carey',
      'Donald King',
      'Donovan Briggans',
      'Ed Hochuli',
      'Ernie Briggs',
      'Gene Steratore',
      'Gene Stetatore',
      'Gerald Austin',
      'Gerald Wright',
      'Gerry Austin',
      'Jeff Triplette',
      'Jerome Boger',
      'Jerry Frump',
      'Jerry Hughes',
      'Jim Core',
      'Jim Sprenger',
      'John Hussey',
      'John Parry',
      'John Perry',
      'John Smith',
      'Johnny Grier',
      'Joseph Rider',
      'Judson Mitchell',
      'Ken Roan',
      'Land Clark',
      'Larry Mallam',
      'Larry Nemmers',
      'Mack Gentry',
      'Matt Nicks',
      'Michael Carey',
      'Mike Carey',
      'Mike Garth',
      'Mike Shepherd',
      'Paul Labenne',
      'Perry Havener',
      'Peter Morelli',
      'Phil Luckett',
      'Randall Beesley',
      'Riley Johnson',
      'Robert Dalton',
      'Robert Frazer',
      'Ron Blum',
      'Ron Torbert',
      'Ron Winter',
      'Ronald Torbert',
      'Scott Green',
      'Scott Novak',
      'Shawn Hochuli',
      'Shawn Smith',
      'Terry McAulay',
      'Tom Corrente',
      'Tom White',
      'Tony Corrente',
      'Tony Steratore',
      'Tra Blake',
      'Walt Anderson',
      'Walt Coleman',
      'Wayne Elliott',
      'Wayne McKreight'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  day: {
    values: [
      'SAT',
      'FRI',
      'MN',
      'SUN',
      'THU',
      'SN',
      'PRO',
      'WED',
      'TUE',
      'HOF',
      'DIV',
      'CONF',
      'SB',
      'WC',
      'PRE'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  is_overtime: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  away_rest: {
    label: 'Away Rest',
    show_key_in_short: true,
    min: 4,
    max: 21,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  home_rest: {
    label: 'Home Rest',
    show_key_in_short: true,
    min: 4,
    max: 21,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.GAME]
  },
  home_moneyline: {
    min: -10000,
    max: 3000,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.BETTING_MARKETS]
  },
  away_moneyline: {
    min: -10000,
    max: 3000,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.BETTING_MARKETS]
  },
  total_line: {
    label: 'Total Line',
    show_key_in_short: true,
    min: 25,
    max: 65,
    step: 0.5,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.BETTING_MARKETS]
  }
}

export default {
  career_year,
  career_game,

  nfl_week_id,
  year_offset,

  ...nfl_games_params,

  down_number: {
    values: nfl_downs,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION],
    preset_values: [
      {
        label: 'Early Downs',
        values: [1, 2]
      },
      {
        label: 'Late Downs',
        values: [3, 4]
      }
    ]
  },
  quarter: {
    values: nfl_quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION],
    preset_values: [
      {
        label: 'First Half',
        values: [1, 2]
      },
      {
        label: 'Second Half',
        values: [3, 4]
      }
    ]
  },

  play_type: {
    values: [
      { value: 'PASS', label: 'PASS', group: 'Pass' },
      { value: 'RUSH', label: 'RUSH', group: 'Run' },
      { value: 'CONV', label: 'CONV', group: 'Special' },
      { value: 'FGXP', label: 'FGXP', group: 'Special' },
      { value: 'KOFF', label: 'KOFF', group: 'Special' },
      { value: 'NOPL', label: 'NOPL', group: 'Special' },
      { value: 'PUNT', label: 'PUNT', group: 'Special' }
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  // play_type_nfl: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // play_type_ngs: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  // TODO look into this
  // next_play_type: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  yard_line_num: {
    label: 'Yardline (from 50)',
    short_label: 'YL from 50',
    show_key_in_short: true,
    min: 1,
    max: 50,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  // TODO
  // yard_line_side: {
  //   values: nfl_team_abbreviations,
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // TODO : eneds to be updating to ydl_100_start and ydl_100_end
  // yard_line_start: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // yard_line_end: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  yard_line_100: {
    label: 'Yardline (yds to end zone)',
    short_label: 'Yds to GL',
    show_key_in_short: true,
    min: 0,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION],
    preset_values: [
      {
        label: 'Redzone',
        values: [0, 20]
      },
      {
        label: 'Inside 10',
        values: [0, 10]
      },
      {
        label: 'Inside 5',
        values: [0, 5]
      },
      {
        label: 'Between 20s',
        values: [20, 80]
      }
    ]
  },

  starting_hash: {
    values: ['RIGHT', 'MIDDLE', 'LEFT'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  is_motion: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_motion_before_snap: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_motion_during_snap: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  yards_to_go: {
    min: 0,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  // TODO data missing
  // yards_from_own_goal: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  off_FORMATION_PERSONNEL: {
    values: [
      'SHOTGUN',
      'SINGLEBACK',
      'I_FORM',
      'EMPTY',
      'JUMBO',
      'PISTOL',
      'WILDCAT'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },
  offense_personnel: {
    data_type: table_constants.TABLE_DATA_TYPES.OBJECT_PRESET,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL],
    column_specs: [
      {
        key: 'rb',
        column: 'offense_personnel_rb_count',
        label: 'RB',
        min: 0,
        max: 4
      },
      {
        key: 'te',
        column: 'offense_personnel_te_count',
        label: 'TE',
        min: 0,
        max: 5
      },
      {
        key: 'wr',
        column: 'offense_personnel_wr_count',
        label: 'WR',
        min: 0,
        max: 5
      },
      {
        key: 'qb',
        column: 'offense_personnel_qb_count',
        label: 'Extra QB',
        min: 0,
        max: 2,
        advanced: true
      },
      {
        key: 'ol',
        column: 'offense_personnel_ol_count',
        label: 'Extra OL (6+)',
        min: 6,
        max: 8,
        advanced: true
      }
    ],
    preset_values: [
      { label: '11 Personnel', value: { rb: 1, te: 1, wr: 3 }, n: 150737 },
      { label: '12 Personnel', value: { rb: 1, te: 2, wr: 2 }, n: 50719 },
      { label: '21 Personnel', value: { rb: 2, te: 1, wr: 2 }, n: 16986 },
      { label: '13 Personnel', value: { rb: 1, te: 3, wr: 1 }, n: 9517 },
      { label: '22 Personnel', value: { rb: 2, te: 2, wr: 1 }, n: 6285 },
      { label: '10 Personnel', value: { rb: 1, te: 0, wr: 4 }, n: 2910 },
      { label: 'Empty (1 TE, 4 WR)', value: { rb: 0, te: 1, wr: 4 }, n: 2064 },
      { label: 'Empty (5 WR)', value: { rb: 0, te: 0, wr: 5 }, n: 496 }
    ]
  },
  defense_personnel: {
    data_type: table_constants.TABLE_DATA_TYPES.OBJECT_PRESET,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL],
    column_specs: [
      {
        key: 'dl',
        column: 'defense_personnel_dl_count',
        label: 'DL',
        min: 0,
        max: 8
      },
      {
        key: 'lb',
        column: 'defense_personnel_lb_count',
        label: 'LB',
        min: 0,
        max: 6
      },
      {
        key: 'db',
        column: 'defense_personnel_db_count',
        label: 'DB',
        min: 3,
        max: 8
      }
    ],
    preset_values: [
      { label: 'Base', value: { db: 4 }, n: 62194 },
      { label: 'Nickel', value: { db: 5 }, n: 156290 },
      { label: 'Dime', value: { db: 6 }, n: 27271 },
      { label: 'Quarter', value: { db: 7 }, n: 1366 },
      { label: 'Base 4-3', value: { dl: 4, lb: 3, db: 4 }, n: 29084 },
      { label: 'Base 3-4', value: { dl: 3, lb: 4, db: 4 }, n: 26253 },
      { label: 'Goal Line', value: { dl: 6 }, n: 785 }
    ]
  },

  box_defenders: {
    label: 'Box Defenders',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE],
    preset_values: [
      {
        label: '8+',
        values: [8, 11]
      }
    ]
  },
  ngs_pass_rushers: {
    label: 'Pass Rushers (unblocked)',
    short_label: 'Unblk PR',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  air_yards: {
    label: 'Air Yards',
    show_key_in_short: true,
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING],
    preset_values: [
      {
        label: '15+',
        values: [15, 99]
      }
    ]
  },
  // TODO allow decimal precision for time_to_throw
  time_to_throw: {
    label: 'Time to Throw',
    show_key_in_short: true,
    min: 0,
    max: 30,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  charted_route: {
    values: [
      'SLANT',
      'SCREEN',
      'FLAT',
      'OUT',
      'GO',
      'IN',
      'POST',
      'HITCH',
      'CROSS',
      'CORNER',
      'ANGLE',
      'WHEEL'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  targeted_receiver_separation: {
    values: [
      'OPEN',
      'TIGHT_COVERAGE',
      'ONE_STEP_OPEN',
      'WIDE_OPEN',
      'CLOSING_COVERAGE'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  man_zone: {
    values: ['MAN_COVERAGE', 'ZONE_COVERAGE'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.COVERAGE]
  },
  cov_type: {
    values: [
      '2_MAN',
      'COVER_0',
      'COVER_1',
      'COVER_2',
      'COVER_3',
      'COVER_4',
      'COVER_6',
      'PREVENT'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.COVERAGE]
  },
  coverage_type: {
    values: [
      'COVER_0',
      'COVER_1',
      'COVER_2',
      'COVER_2_MAN',
      'COVER_3',
      'COVER_4',
      'COVER_5',
      'COVER_6',
      'COVER_9',
      'COMBINATION'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.COVERAGE]
  },

  drive_sequence: {
    label: 'Drive #',
    show_key_in_short: true,
    min: 1,
    max: 50,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_play_count: {
    min: 0,
    max: 30,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_result: {
    values: [
      'Touchdown',
      'Punt',
      'Turnover',
      'Field goal',
      'Turnover on downs',
      'End of half',
      'Missed field goal',
      'Opp touchdown',
      'Safety'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  // TODO change format to allow for range
  // drive_top: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  drive_first_downs: {
    min: 0,
    max: 20,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  is_drive_inside_20: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  is_drive_score: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_start_quarter: {
    values: nfl_quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_end_quarter: {
    values: nfl_quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_yds_penalized: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_start_transition: {
    values: [
      'KICKOFF',
      'PUNT',
      'INTERCEPTION',
      'FUMBLE',
      'DOWNS',
      'MISSED_FG',
      'MUFFED_PUNT',
      'ONSIDE_KICK',
      'BLOCKED_FG',
      'BLOCKED_FG_DOWNS',
      'MUFFED_KICKOFF',
      'BLOCKED_PUNT',
      'BLOCKED_PUNT_DOWNS',
      'BLOCKED_FG,_DOWNS',
      'BLOCKED_PUNT,_DOWNS'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_end_transition: {
    values: [
      'TOUCHDOWN',
      'PUNT',
      'INTERCEPTION',
      'FUMBLE',
      'FIELD_GOAL',
      'DOWNS',
      'END_GAME',
      'MISSED_FG',
      'END_HALF',
      'FUMBLE_SAFETY',
      'BLOCKED_PUNT',
      'SAFETY',
      'BLOCKED_FG',
      'BLOCKED_FG_DOWNS',
      'BLOCKED_PUNT_DOWNS',
      'BLOCKED_FG,_DOWNS',
      'FUMBLE,_SAFETY',
      'BLOCKED_PUNT,_DOWNS'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  // TODO change format to allow for range
  // drive_game_clock_start: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // drive_game_clock_end: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  // TODO change format to allow for range, use drive_start_ydl_100, drive_end_ydl_100
  // drive_start_yard_line: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // drive_end_yard_line: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  series_sequence: {
    label: 'Series #',
    show_key_in_short: true,
    min: 1,
    max: 90,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SERIES]
  },
  is_series_successful: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SERIES]
  },
  series_result: {
    values: [
      'END_OF_HALF',
      'FIELD_GOAL',
      'FIRST_DOWN',
      'MISSED_FIELD_GOAL',
      'OPP_TOUCHDOWN',
      'PUNT',
      'QB_KNEEL',
      'SAFETY',
      'TOUCHDOWN',
      'TURNOVER',
      'TURNOVER_ON_DOWNS'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.SERIES]
  },

  is_goal_to_go: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  is_scoring_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  score_type: {
    values: ['FG', 'PAT', 'PAT2', 'SFTY', 'TD'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  score_team: {
    values: nfl_team_abbreviations,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  play_clock: {
    label: 'Play Clock',
    show_key_in_short: true,
    min: 0,
    max: 90, // TODO figure out why this is so high
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PACE]
  },

  // TODO change format to allow for range
  // game_clock_start: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // game_clock_end: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  seconds_remaining_quarter: {
    label: 'Secs Remaining (Qtr)',
    short_label: 'Sec Qtr',
    show_key_in_short: true,
    min: 0,
    max: 900,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  seconds_remaining_half: {
    label: 'Secs Remaining (Half)',
    short_label: 'Sec Half',
    show_key_in_short: true,
    min: 0,
    max: 1800,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  seconds_remaining_game: {
    label: 'Secs Remaining (Game)',
    short_label: 'Sec Gm',
    show_key_in_short: true,
    min: 0,
    max: 3600,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  possession_nfl_team: {
    values: nfl_team_param_values,
    value_groups: nfl_team_value_groups,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  offense_nfl_team: {
    values: nfl_team_param_values,
    value_groups: nfl_team_value_groups,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  defense_nfl_team: {
    values: nfl_team_param_values,
    value_groups: nfl_team_value_groups,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  // review: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  yds_gained: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    preset_values: [
      {
        label: '10+',
        values: [10, 99]
      }
    ],
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  is_fumble: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_fumble_lost: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_interception: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_sack: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_successful_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_completion: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_incompletion: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_trick_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_touchback: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_safety: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_penalty: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_out_of_bounds: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_tackle_for_loss: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_rushing_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  is_passing_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  is_solo_tackle: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_assist_tackle: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  is_special_teams_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  // TODO look into this
  // special_play_type: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  pen_team: {
    values: nfl_team_abbreviations,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PENALTY]
  },
  pen_yds: {
    min: 0,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PENALTY]
  },

  is_touchdown: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_return_touchdown: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_passing_touchdown: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_rushing_touchdown: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  // TODO look into this
  // td_nfl_team: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  pass_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING],
    preset_values: [
      {
        label: '10+',
        values: [10, 99]
      },
      {
        label: '15+',
        values: [15, 99]
      },
      {
        label: '30+',
        values: [20, 99]
      },
      {
        label: '40+',
        values: [40, 99]
      }
    ]
  },
  recv_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING],
    preset_values: [
      {
        label: '10+',
        values: [10, 99]
      },
      {
        label: '15+',
        values: [15, 99]
      },
      {
        label: '30+',
        values: [20, 99]
      },
      {
        label: '40+',
        values: [40, 99]
      }
    ]
  },
  rush_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RUSHING],
    preset_values: [
      {
        label: '10+',
        values: [10, 99]
      },
      {
        label: '15+',
        values: [15, 99]
      },
      {
        label: '30+',
        values: [20, 99]
      },
      {
        label: '40+',
        values: [40, 99]
      }
    ]
  },

  dot: {
    // The PARAM key stays `dot` -- it is a user-facing API key that saved views
    // persist, and renaming it would silently drop the filter on every view
    // holding the old key. Only the physical column moved.
    column_name: 'depth_of_target',
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING],
    preset_values: [
      {
        label: '10+',
        values: [10, 99]
      },
      {
        label: '15+',
        values: [15, 99]
      },
      {
        label: '30+',
        values: [20, 99]
      },
      {
        label: '40+',
        values: [40, 99]
      }
    ]
  },
  is_endzone_target: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  true_air_yards: {
    min: -40,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  yards_after_catch: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  yards_after_any_contact: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  return_yds: {
    min: -100,
    max: 120,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  // return_nfl_team: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  is_no_huddle: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  is_play_action: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_qb_dropback: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_qb_kneel: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_qb_spike: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_qb_rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  is_qb_sneak: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  is_qb_scramble: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },

  is_qb_pressure: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  is_qb_pressure_tracking: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  is_qb_hit: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  is_qb_hurry: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },

  is_interception_worthy: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_catchable_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_throw_away: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_shovel_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_sideline_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_highlight_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  is_dropped_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_contested_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_created_reception: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  is_pass_breakup: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  missed_or_broken_tackle: {
    label: 'Missed/Broken Tackles',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  avoided_sacks: {
    label: 'Avoided Sacks',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },

  run_location: {
    values: ['LEFT', 'RIGHT', 'MIDDLE'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  run_gap: {
    values: [
      'LEFT_END',
      'LEFT_TACKLE',
      'LEFT_GUARD',
      'LEFT_MIDDLE',
      'RIGHT_GUARD',
      'RIGHT_TACKLE',
      'RIGHT_END',
      'RIGHT_MIDDLE',
      'MIDDLE'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },

  pass_location: {
    values: ['LEFT', 'RIGHT', 'MIDDLE'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  is_trick_look: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },

  is_first_down: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_first_down_rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  is_first_down_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_first_down_penalty: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PENALTY]
  },

  is_third_down_converted: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_third_down_failed: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_fourth_down_converted: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_fourth_down_failed: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  is_hindered_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_zero_blitz: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  is_stunt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  is_out_of_pocket_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_physical_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  is_batted_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_screen_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  is_pain_free_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  is_run_play_option: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  is_qb_fault_sack: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  qb_position: {
    values: ['UNDER_CENTER', 'SHOTGUN', 'PISTOL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },

  read_thrown: {
    values: ['FIRST', 'SECOND', 'DESIGNED', 'CHECKDOWN', 'SCRAMBLE_DRILL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  number_offense_backfield: {
    label: 'Backfield Players',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },

  // TODO
  // ttscrm: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  time_to_pass: {
    label: 'Time to Pass',
    show_key_in_short: true,
    min: 0,
    max: 15,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  // TODO
  // time_to_sack: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  time_to_pressure: {
    label: 'Time to Pressure',
    show_key_in_short: true,
    min: 0,
    max: 15,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  // TODO
  // backfield_player_count: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // extra_men_on_line: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  defensive_back_count: {
    label: 'DBs in Box',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  box_defenders_charted: {
    label: 'Box Defenders (charted)',
    short_label: 'Box Def chart',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    preset_values: [
      {
        label: '8+',
        values: [8, 11]
      }
    ],
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  defensive_backs_in_box: {
    label: 'Box DBs',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  pass_rushers: {
    label: 'Pass Rushers',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  blitzers: {
    label: 'Blitzers',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  db_blitzers: {
    label: 'DB Blitzers',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  out_of_pocket_details: {
    values: ['C', 'P', 'D', 'DR', 'BT', 'BL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  coverage_on_target: {
    values: [0, 1, 2],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.COVERAGE]
  },

  expected_points: {
    label: 'EP',
    show_key_in_short: true,
    min: -4,
    max: 7,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  epa: {
    label: 'EPA',
    show_key_in_short: true,
    min: -14,
    max: 14,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS],
    preset_values: [
      {
        label: '0+',
        values: [0, 14]
      }
    ]
  },
  is_epa_successful: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },

  total_home_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_home_rush_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_rush_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_home_pass_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_pass_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },

  qb_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  comp_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  comp_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  xyac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_home_comp_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_comp_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_home_comp_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_comp_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_home_raw_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_raw_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_home_raw_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  total_away_raw_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },

  win_probability: {
    label: 'Win Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY],
    preset_values: [
      {
        label: 'Exclude Garbage Time (20% to 80%)',
        values: [0.2, 0.8]
      },
      {
        label: 'Neutral (35% to 65%)',
        values: [0.35, 0.65]
      }
    ]
  },
  win_probability_added: {
    label: 'Win Prob Added',
    show_key_in_short: true,
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY],
    preset_values: [
      {
        label: '0+',
        values: [0, 1]
      }
    ]
  },
  home_win_probability: {
    label: 'Home Win Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  away_win_probability: {
    label: 'Away Win Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_wpa: {
    label: 'Vegas WPA',
    show_key_in_short: true,
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_home_wpa: {
    label: 'Vegas Home WPA',
    show_key_in_short: true,
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  home_win_probability_post: {
    label: 'Home Win Prob (post)',
    short_label: 'H WP post',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  away_win_probability_post: {
    label: 'Away Win Prob (post)',
    short_label: 'A WP post',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_win_probability: {
    label: 'Vegas Win Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_home_win_probability: {
    label: 'Vegas Home Win Prob',
    short_label: 'V Home WP',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_home_rush_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_away_rush_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_home_pass_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_away_pass_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  comp_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  comp_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_home_comp_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_away_comp_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_home_comp_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_away_comp_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_home_raw_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_away_raw_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_home_raw_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  total_away_raw_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },

  xyac_mean_yds: {
    min: 0,
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  xyac_median_yds: {
    min: 0,
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  xyac_success_prob: {
    label: 'xYAC Success Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  xyac_first_down_prob: {
    label: 'xYAC First Down Prob',
    short_label: 'xYAC FD',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },

  is_extra_point_attempt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  is_two_point_conversion_attempt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  is_field_goal_attempt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  is_kickoff_attempt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  is_punt_attempt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },

  fg_result: {
    values: ['blocked', 'made', 'missed'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  kick_distance: {
    min: 0, // TODO figure out why there is a play with -1
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  ep_result: {
    values: ['blocked', 'failed', 'good'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  // TODO change to boolean
  // two_point_result: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  is_punt_blocked: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  home_timeouts_remaining: {
    label: 'Home TOs Remaining',
    short_label: 'H TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  away_timeouts_remaining: {
    label: 'Away TOs Remaining',
    short_label: 'A TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  pos_timeouts_remaining: {
    label: 'Possession TOs Remaining',
    short_label: 'Pos TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  defense_timeouts_remaining: {
    label: 'Defending TOs Remaining',
    short_label: 'Def TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  is_timeout: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  timeout_team: {
    values: nfl_team_abbreviations,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },

  home_score: {
    label: 'Home Score',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  away_score: {
    label: 'Away Score',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  pos_score: {
    label: 'Possession Team Score',
    short_label: 'Pos Score',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  defense_score: {
    label: 'Defending Team Score',
    short_label: 'Def Score',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  score_difference: {
    label: 'Score Diff',
    show_key_in_short: true,
    min: -70,
    max: 70,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE],
    preset_values: score_diff_preset_values
  },
  pos_score_post: {
    label: 'Possession Score (post)',
    short_label: 'Pos post',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  defense_score_post: {
    label: 'Defending Score (post)',
    short_label: 'Def post',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  score_difference_post: {
    label: 'Score Diff (post)',
    short_label: 'Diff post',
    show_key_in_short: true,
    min: -70,
    max: 70,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE],
    preset_values: score_diff_preset_values
  },

  no_score_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  opp_fg_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  opp_safety_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  opp_td_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  fg_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  safety_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  td_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  extra_point_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },
  two_conversion_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PROBABILITY]
  },

  xpass_prob: {
    label: 'xPass Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  pass_over_expected: {
    label: 'Pass OE',
    show_key_in_short: true,
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  completion_probability: {
    label: 'Completion Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  completion_percentage_over_expected: {
    label: 'CPOE',
    show_key_in_short: true,
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  }
}
