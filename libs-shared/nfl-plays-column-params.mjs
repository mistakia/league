import * as table_constants from 'react-table/src/constants.mjs'
import { nfl_downs, nfl_quarters, nfl_team_abbreviations } from '#constants'
import { COLUMN_PARAM_GROUPS } from './column-param-groups.mjs'

import {
  career_year,
  career_game,
  year_offset,
  nfl_week_id
} from './common-column-params.mjs'

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
  surf: {
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
  wind: {
    label: 'Wind',
    show_key_in_short: true,
    min: 0,
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WEATHER]
  },
  temp: {
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
  ot: {
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

  dwn: {
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
  qtr: {
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
    values: ['CONV', 'FGXP', 'KOFF', 'NOPL', 'PASS', 'PUNT', 'RUSH'],
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

  ydl_num: {
    label: 'Yardline (from 50)',
    short_label: 'YL from 50',
    show_key_in_short: true,
    min: 1,
    max: 50,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  // TODO
  // ydl_side: {
  //   values: nfl_team_abbreviations,
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // TODO : eneds to be updating to ydl_100_start and ydl_100_end
  // ydl_start: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // ydl_end: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  ydl_100: {
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

  motion: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  motion_before_snap: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  motion_during_snap: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  yards_to_go: {
    min: 0,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  // TODO data missing
  // yfog: {
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
  off_personnel: {
    data_type: table_constants.TABLE_DATA_TYPES.OBJECT_PRESET,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL],
    column_specs: [
      {
        key: 'rb',
        column: 'off_personnel_rb_count',
        label: 'RB',
        min: 0,
        max: 4
      },
      {
        key: 'te',
        column: 'off_personnel_te_count',
        label: 'TE',
        min: 0,
        max: 5
      },
      {
        key: 'wr',
        column: 'off_personnel_wr_count',
        label: 'WR',
        min: 0,
        max: 5
      },
      {
        key: 'qb',
        column: 'off_personnel_qb_count',
        label: 'Extra QB',
        min: 0,
        max: 2,
        advanced: true
      },
      {
        key: 'ol',
        column: 'off_personnel_ol_count',
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
  def_personnel: {
    data_type: table_constants.TABLE_DATA_TYPES.OBJECT_PRESET,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL],
    column_specs: [
      {
        key: 'dl',
        column: 'def_personnel_dl_count',
        label: 'DL',
        min: 0,
        max: 8
      },
      {
        key: 'lb',
        column: 'def_personnel_lb_count',
        label: 'LB',
        min: 0,
        max: 6
      },
      {
        key: 'db',
        column: 'def_personnel_db_count',
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
  pru: {
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
  route: {
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

  drive_seq: {
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
  drive_fds: {
    min: 0,
    max: 20,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_inside20: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_score: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_start_qtr: {
    values: nfl_quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_end_qtr: {
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
  // drive_start_ydl: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // drive_end_ydl: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  series_seq: {
    label: 'Series #',
    show_key_in_short: true,
    min: 1,
    max: 90,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SERIES]
  },
  series_suc: {
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

  goal_to_go: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  score: {
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
  sec_rem_qtr: {
    label: 'Secs Remaining (Qtr)',
    short_label: 'Sec Qtr',
    show_key_in_short: true,
    min: 0,
    max: 900,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  sec_rem_half: {
    label: 'Secs Remaining (Half)',
    short_label: 'Sec Half',
    show_key_in_short: true,
    min: 0,
    max: 1800,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  sec_rem_gm: {
    label: 'Secs Remaining (Game)',
    short_label: 'Sec Gm',
    show_key_in_short: true,
    min: 0,
    max: 3600,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  pos_team: {
    values: nfl_team_abbreviations,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  off: {
    values: nfl_team_abbreviations,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  def: {
    values: nfl_team_abbreviations,
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

  fum: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  fuml: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  int: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  sk: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  successful_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  comp: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  incomp: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  trick_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  touchback: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  safety: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  penalty: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  oob: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  tfl: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  solo_tk: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  assist_tk: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  special: {
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

  td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  ret_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  pass_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  rush_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  // TODO look into this
  // td_tm: {
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
  endzone_target: {
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
  ret_yds: {
    min: -100,
    max: 120,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  // ret_tm: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  no_huddle: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  play_action: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  qb_dropback: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  qb_kneel: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_spike: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  qb_rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  qb_sneak: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  qb_scramble: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },

  qb_pressure: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  qb_pressure_tracking: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  qb_hit: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },
  qb_hurry: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PRESSURE]
  },

  int_worthy: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  catchable_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  throw_away: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  shovel_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  sideline_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  highlight_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  dropped_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  contested_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  created_reception: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  pass_breakup: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },

  mbt: {
    label: 'Missed/Broken Tackles',
    show_key_in_short: true,
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  avsk: {
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

  trick_look: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },

  first_down: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  first_down_rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.RUSHING]
  },
  first_down_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  first_down_penalty: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PENALTY]
  },

  third_down_converted: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  third_down_failed: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  fourth_down_converted: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  fourth_down_failed: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  hindered_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  zero_blitz: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  stunt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  out_of_pocket_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  phyb: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  batted_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  screen_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  pain_free_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },
  run_play_option: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TYPE]
  },
  qb_fault_sack: {
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

  n_offense_backfield: {
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
  // ttsk: {
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
  // back: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  // xlm: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  db: {
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
  boxdb: {
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
  oopd: {
    values: ['C', 'P', 'D', 'DR', 'BT', 'BL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  cov: {
    values: [0, 1, 2],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.COVERAGE]
  },

  ep: {
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
  ep_succ: {
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

  wp: {
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
  wpa: {
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
  home_wp: {
    label: 'Home Win Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  away_wp: {
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
  home_wp_post: {
    label: 'Home Win Prob (post)',
    short_label: 'H WP post',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  away_wp_post: {
    label: 'Away Win Prob (post)',
    short_label: 'A WP post',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_wp: {
    label: 'Vegas Win Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_home_wp: {
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
  xyac_succ_prob: {
    label: 'xYAC Success Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  xyac_fd_prob: {
    label: 'xYAC First Down Prob',
    short_label: 'xYAC FD',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },

  ep_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  two_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  fg_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  kickoff_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.SPECIAL_TEAMS]
  },
  punt_att: {
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
  // tp_result: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  punt_blocked: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  home_to_rem: {
    label: 'Home TOs Remaining',
    short_label: 'H TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  away_to_rem: {
    label: 'Away TOs Remaining',
    short_label: 'A TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  pos_to_rem: {
    label: 'Possession TOs Remaining',
    short_label: 'Pos TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  def_to_rem: {
    label: 'Defending TOs Remaining',
    short_label: 'Def TO',
    show_key_in_short: true,
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  to: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  to_team: {
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
  def_score: {
    label: 'Defending Team Score',
    short_label: 'Def Score',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  score_diff: {
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
  def_score_post: {
    label: 'Defending Score (post)',
    short_label: 'Def post',
    show_key_in_short: true,
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  score_diff_post: {
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
  two_conv_prob: {
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
  pass_oe: {
    label: 'Pass OE',
    show_key_in_short: true,
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  cp: {
    label: 'Completion Prob',
    show_key_in_short: true,
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  cpoe: {
    label: 'CPOE',
    show_key_in_short: true,
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  }
}
