import * as table_constants from 'react-table/src/constants.mjs'
import * as constants from './constants.mjs'
import { COLUMN_PARAM_GROUPS } from './column-param-groups.mjs'

import {
  career_year,
  career_game,
  year,
  week,
  year_offset
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

export default {
  career_year,
  career_game,

  year,
  year_offset,
  // TODO
  // seas_type: {
  //   values: constants.seas_types,
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  week,

  dwn: {
    values: constants.downs,
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
    values: constants.quarters,
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
    min: 1,
    max: 50,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  // TODO
  // ydl_side: {
  //   values: constants.nflTeams,
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
    values: [
      '0 RB, 0 TE, 0 WR',
      '0 RB, 0 TE, 0 WR,1 P,1 LB,1 LS,2 DL,1 K',
      '0 RB, 0 TE, 0 WR,1 P,1 LS,3 DL,1 K',
      '0 RB, 0 TE, 0 WR,1 P,4 LB,1 LS,5 DB',
      '0 RB, 0 TE, 0 WR,2 LB,4 DL,5 DB',
      '0 RB, 0 TE, 1 WR,1 P,1 LB,1 LS,3 DB',
      '0 RB, 0 TE, 1 WR,1 P,3 LB,1 LS,5 DB',
      '0 RB, 0 TE, 1 WR,1 P,4 LB,1 LS,4 DB',
      '0 RB, 0 TE, 2 WR,1 P,4 LB,1 LS,3 DB',
      '0 RB, 0 TE, 2 WR,1 P,5 LB,1 LS,2 DB',
      '0 RB, 0 TE, 2 WR,2 LB,1 K,6 DB',
      '0 RB, 0 TE, 3 WR,1 LB,1 DB',
      '0 RB, 0 TE, 3 WR,2 DL',
      '0 RB, 0 TE, 4 WR,1 LB',
      '0 RB, 0 TE, 5 WR',
      '0 RB, 1 TE, 0 WR,1 P,1 LB,1 LS,1 DL,1 K',
      '0 RB, 1 TE, 0 WR,1 P,1 LB,1 LS,2 DL,1 K',
      '0 RB, 1 TE, 0 WR,1 P,1 LS,2 DL,1 K',
      '0 RB, 1 TE, 0 WR,1 P,1 LS,3 DL,1 K',
      '0 RB, 1 TE, 0 WR,1 P,3 LB,1 LS,1 DL,4 DB',
      '0 RB, 1 TE, 0 WR,1 P,4 LB,1 LS,1 DL,3 DB',
      '0 RB, 1 TE, 0 WR,1 P,4 LB,1 LS,4 DB',
      '0 RB, 1 TE, 0 WR,1 P,5 LB,1 LS,3 DB',
      '0 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,1 DL,3 DB',
      '0 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,4 DB',
      '0 RB, 1 TE, 1 WR,1 P,4 LB,1 LS,1 DL,2 DB',
      '0 RB, 1 TE, 1 WR,1 P,4 LB,1 LS,3 DB',
      '0 RB, 1 TE, 1 WR,1 P,5 LB,1 LS,2 DB',
      '0 RB, 1 TE, 1 WR,1 P,6 LB,1 LS,1 DB',
      '0 RB, 1 TE, 2 WR',
      '0 RB, 1 TE, 2 WR,1 LB,1 DB',
      '0 RB, 1 TE, 2 WR,1 P,3 LB,1 LS,3 DB',
      '0 RB, 1 TE, 2 WR,1 P,4 LB,1 LS,2 DB',
      '0 RB, 1 TE, 2 WR,2 DL',
      '0 RB, 1 TE, 3 WR',
      '0 RB, 1 TE, 3 WR,1 DB',
      '0 RB, 1 TE, 3 WR,1 DL',
      '0 RB, 1 TE, 3 WR,1 LB',
      '0 RB, 1 TE, 3 WR,3 DB',
      '0 RB, 1 TE, 4 WR',
      '0 RB, 1 TE, 4 WR,1 DL',
      '0 RB, 2 TE, 0 WR,1 P,1 LS,1 DL,1 DB',
      '0 RB, 2 TE, 0 WR,1 P,1 LS,1 DL,1 K',
      '0 RB, 2 TE, 0 WR,1 P,1 LS,2 DL,1 K',
      '0 RB, 2 TE, 0 WR,1 P,1 LS,3 DL,1 K',
      '0 RB, 2 TE, 0 WR,1 P,3 LB,1 LS,4 DB',
      '0 RB, 2 TE, 0 WR,1 P,4 LB,1 LS,1 DL,2 DB',
      '0 RB, 2 TE, 0 WR,1 P,4 LB,1 LS,3 DB',
      '0 RB, 2 TE, 1 WR',
      '0 RB, 2 TE, 1 WR,1 P,2 LB,1 LS,2 DL,2 DB',
      '0 RB, 2 TE, 1 WR,1 P,3 LB,1 LS,1 DL,2 DB',
      '0 RB, 2 TE, 1 WR,1 P,3 LB,1 LS,3 DB',
      '0 RB, 2 TE, 1 WR,1 P,4 LB,1 LS,2 DB',
      '0 RB, 2 TE, 1 WR,1 P,5 LB,1 LS,1 DB',
      '0 RB, 2 TE, 1 WR,2 DL',
      '0 RB, 2 TE, 2 WR',
      '0 RB, 2 TE, 2 WR,1 DB',
      '0 RB, 2 TE, 2 WR,1 DL',
      '0 RB, 2 TE, 2 WR,1 LB',
      '0 RB, 2 TE, 2 WR,1 P,3 LB,1 LS,2 DB',
      '0 RB, 2 TE, 2 WR,3 DB',
      '0 RB, 2 TE, 3 WR',
      '0 RB, 2 TE, 4 WR',
      '0 RB, 3 TE, 0 WR,1 P,1 DL,1 K',
      '0 RB, 3 TE, 0 WR,1 P,2 LB,1 LS,1 DL,3 DB',
      '0 RB, 3 TE, 0 WR,1 P,3 LB,1 LS,3 DB',
      '0 RB, 3 TE, 1 WR,1 DL',
      '0 RB, 3 TE, 1 WR,1 P,3 LB,1 LS,2 DB',
      '0 RB, 3 TE, 2 WR',
      '0 RB, 3 TE, 2 WR,1 DL',
      '0 RB, 3 TE, 3 WR',
      '0 RB, 4 TE, 1 WR',
      '0 RB, 5 TE, 0 WR',
      '1 RB, 0 TE, 0 WR,1 P,3 LB,1 LS,1 DL,4 DB',
      '1 RB, 0 TE, 0 WR,1 P,4 LB,1 LS,1 DL,3 DB',
      '1 RB, 0 TE, 0 WR,1 P,4 LB,1 LS,3 DB',
      '1 RB, 0 TE, 0 WR,1 P,4 LB,1 LS,4 DB',
      '1 RB, 0 TE, 0 WR,1 P,5 LB,1 LS,3 DB',
      '1 RB, 0 TE, 0 WR,3 LB,1 K,6 DB',
      '1 RB, 0 TE, 1 WR,1 P,2 LB,1 LS,2 DL,3 DB',
      '1 RB, 0 TE, 1 WR,1 P,3 LB,1 LS,1 DL,3 DB',
      '1 RB, 0 TE, 1 WR,1 P,3 LB,1 LS,4 DB',
      '1 RB, 0 TE, 1 WR,1 P,4 LB,1 LS,1 DL,2 DB',
      '1 RB, 0 TE, 1 WR,1 P,4 LB,1 LS,3 DB',
      '1 RB, 0 TE, 1 WR,1 P,5 LB,1 LS,1 DB',
      '1 RB, 0 TE, 2 WR',
      '1 RB, 0 TE, 2 WR,1 P,3 LB,1 LS,1 DL,2 DB',
      '1 RB, 0 TE, 2 WR,1 P,4 LB,1 LS,2 DB',
      '1 RB, 0 TE, 2 WR,4 LB,1 LS,1 DL,2 DB',
      '1 RB, 0 TE, 3 WR',
      '1 RB, 0 TE, 3 WR,1 DB',
      '1 RB, 0 TE, 3 WR,1 DL',
      '1 RB, 0 TE, 3 WR,1 LB',
      '1 RB, 0 TE, 3 WR,1 LB,1 DL',
      '1 RB, 0 TE, 4 WR',
      '1 RB, 0 TE, 4 WR,1 DL',
      '1 RB, 0 TE, 5 WR',
      '1 RB, 1 TE, 0 WR,1 P,2 LB,1 LS,1 DL,3 DB',
      '1 RB, 1 TE, 0 WR,1 P,3 LB,1 LS,1 DL,3 DB',
      '1 RB, 1 TE, 0 WR,1 P,3 LB,1 LS,4 DB',
      '1 RB, 1 TE, 0 WR,1 P,4 LB,1 LS,1 DL,2 DB',
      '1 RB, 1 TE, 0 WR,1 P,4 LB,1 LS,3 DB',
      '1 RB, 1 TE, 0 WR,1 P,5 LB,1 LS,2 DB',
      '1 RB, 1 TE, 0 WR,2 LB,1 K,6 DB',
      '1 RB, 1 TE, 1 WR',
      '1 RB, 1 TE, 1 WR,1 LB',
      '1 RB, 1 TE, 1 WR,1 LB,1 DL',
      '1 RB, 1 TE, 1 WR,1 P,1 LS,1 DB',
      '1 RB, 1 TE, 1 WR,1 P,2 LB,1 LS,1 DL,3 DB',
      '1 RB, 1 TE, 1 WR,1 P,2 LB,1 LS,2 DB',
      '1 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,1 DL,2 DB',
      '1 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,2 DB',
      '1 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,3 DB',
      '1 RB, 1 TE, 1 WR,1 P,4 LB,1 LS,1 DL,1 DB',
      '1 RB, 1 TE, 1 WR,1 P,4 LB,1 LS,2 DB',
      '1 RB, 1 TE, 1 WR,2 DL',
      '1 RB, 1 TE, 2 WR',
      '1 RB, 1 TE, 2 WR,1 DB',
      '1 RB, 1 TE, 2 WR,1 DL',
      '1 RB, 1 TE, 2 WR,1 H-B',
      '1 RB, 1 TE, 2 WR,1 LB',
      '1 RB, 1 TE, 2 WR,1 P,3 LB,1 LS,1 DL,1 DB',
      '1 RB, 1 TE, 2 WR,1 P,3 LB,1 LS,2 DB',
      '1 RB, 1 TE, 2 WR,1 P,4 LB,1 LS',
      '1 RB, 1 TE, 2 WR,1 PR',
      '1 RB, 1 TE, 3 WR',
      '1 RB, 1 TE, 3 WR,1 DB',
      '1 RB, 1 TE, 3 WR,1 DL',
      '1 RB, 1 TE, 3 WR,1 LB',
      '1 RB, 1 TE, 3 WR,1 P,1 LS,1 K',
      '1 RB, 1 TE, 3 WR,1 P,2 LB,1 LS,2 DB',
      '1 RB, 1 TE, 3 WR,1 P,3 LB,1 LS,1 DB',
      '1 RB, 1 TE, 3 WR,2 DB',
      '1 RB, 1 TE, 4 WR',
      '1 RB, 2 TE, 0 WR,1 LB,1 DL',
      '1 RB, 2 TE, 0 WR,1 P,2 LB,1 LS,1 DL,3 DB',
      '1 RB, 2 TE, 0 WR,1 P,3 LB,1 LS,3 DB',
      '1 RB, 2 TE, 0 WR,2 DL',
      '1 RB, 2 TE, 0 WR,3 LB,1 DL,1 K,3 DB',
      '1 RB, 2 TE, 1 WR',
      '1 RB, 2 TE, 1 WR,1 DB',
      '1 RB, 2 TE, 1 WR,1 DL',
      '1 RB, 2 TE, 1 WR,1 LB',
      '1 RB, 2 TE, 1 WR,1 LB,1 DL',
      '1 RB, 2 TE, 1 WR,1 P,2 LB,1 LS,3 DB',
      '1 RB, 2 TE, 1 WR,1 P,3 LB,1 LS,1 DL,1 DB',
      '1 RB, 2 TE, 1 WR,1 P,3 LB,1 LS,2 DB',
      '1 RB, 2 TE, 1 WR,1 P,4 LB,1 LS,1 DB',
      '1 RB, 2 TE, 1 WR,1 PR',
      '1 RB, 2 TE, 2 WR',
      '1 RB, 2 TE, 2 WR,1 DB',
      '1 RB, 2 TE, 2 WR,1 DL',
      '1 RB, 2 TE, 2 WR,1 LB',
      '1 RB, 2 TE, 2 WR,1 P,3 LB,1 LS,1 DB',
      '1 RB, 2 TE, 2 WR,2 DB',
      '1 RB, 2 TE, 3 WR',
      '1 RB, 2 TE, 4 WR',
      '1 RB, 3 TE, 0 WR',
      '1 RB, 3 TE, 0 WR,1 DB',
      '1 RB, 3 TE, 0 WR,1 DL',
      '1 RB, 3 TE, 0 WR,1 LB',
      '1 RB, 3 TE, 1 WR',
      '1 RB, 3 TE, 1 WR,1 DL',
      '1 RB, 3 TE, 1 WR,1 P,2 LB,1 LS,2 DB',
      '1 RB, 3 TE, 1 WR,2 DB',
      '1 RB, 3 TE, 2 WR',
      '1 RB, 3 TE, 3 WR',
      '1 RB, 4 TE, 0 WR',
      '1 RB, 4 TE, 0 WR,2 DB',
      '1 RB, 4 TE, 1 WR',
      '2 QB, 0 RB, 1 TE, 3 WR',
      '2 QB, 0 RB, 2 TE, 1 WR,1 DL',
      '2 QB, 0 RB, 2 TE, 2 WR',
      '2 QB, 0 RB, 3 TE, 1 WR',
      '2 QB, 1 RB, 0 TE, 3 WR',
      '2 QB, 1 RB, 1 TE, 1 WR,1 DL',
      '2 QB, 1 RB, 1 TE, 2 WR',
      '2 QB, 1 RB, 1 TE, 3 WR',
      '2 QB, 1 RB, 1 TE, 4 WR,1 LS',
      '2 QB, 1 RB, 2 TE, 0 WR,1 DL',
      '2 QB, 1 RB, 2 TE, 0 WR,1 LB',
      '2 QB, 1 RB, 2 TE, 1 WR',
      '2 QB, 1 RB, 2 TE, 1 WR,1 DL',
      '2 QB, 1 RB, 2 TE, 2 WR',
      '2 QB, 1 RB, 3 TE, 0 WR',
      '2 QB, 1 RB, 3 TE, 1 WR',
      '2 QB, 1 RB, 3 TE, 2 WR',
      '2 QB, 2 RB, 0 TE, 2 WR',
      '2 QB, 2 RB, 1 TE, 1 WR',
      '2 QB, 2 RB, 1 TE, 1 WR,1 DL',
      '2 QB, 2 RB, 2 TE, 0 WR',
      '2 QB, 2 RB, 2 TE, 0 WR,1 DL',
      '2 QB, 2 RB, 2 TE, 1 WR',
      '2 QB, 3 RB, 0 TE, 1 WR',
      '2 QB, 3 RB, 1 TE, 0 WR',
      '2 QB, 6 OL, 0 RB, 1 TE, 2 WR',
      '2 QB, 6 OL, 1 RB, 0 TE, 2 WR',
      '2 QB, 6 OL, 1 RB, 1 TE, 0 WR,1 DL',
      '2 QB, 6 OL, 1 RB, 1 TE, 1 WR',
      '2 QB, 6 OL, 1 RB, 2 TE, 0 WR',
      '2 QB, 6 OL, 2 RB, 0 TE, 1 WR',
      '2 QB, 6 OL, 2 RB, 1 TE, 0 WR',
      '2 RB, 0 TE, 0 WR,1 P,3 LB,1 LS,3 DB',
      '2 RB, 0 TE, 0 WR,1 P,4 LB,1 LS,3 DB',
      '2 RB, 0 TE, 0 WR,1 P,5 LB,1 LS,2 DB',
      '2 RB, 0 TE, 1 WR,1 P,1 LB,1 DL,5 DB',
      '2 RB, 0 TE, 1 WR,1 P,1 LS,1 DB',
      '2 RB, 0 TE, 1 WR,1 P,3 LB,1 LS,1 DL,2 DB',
      '2 RB, 0 TE, 1 WR,1 P,3 LB,1 LS,3 DB',
      '2 RB, 0 TE, 1 WR,1 P,4 LB,1 LS,2 DB',
      '2 RB, 0 TE, 1 WR,4 LB,1 DL,3 DB',
      '2 RB, 0 TE, 2 WR,1 DB',
      '2 RB, 0 TE, 2 WR,1 DL',
      '2 RB, 0 TE, 2 WR,1 P,3 LB,1 LS,2 DB',
      '2 RB, 0 TE, 2 WR,1 P,4 LB,1 LS,1 DB',
      '2 RB, 0 TE, 2 WR,1 PR',
      '2 RB, 0 TE, 2 WR,3 LB,1 K,2 DB',
      '2 RB, 0 TE, 3 WR',
      '2 RB, 0 TE, 4 WR',
      '2 RB, 1 TE, 0 WR,1 P,2 LB,1 LS,4 DB',
      '2 RB, 1 TE, 0 WR,1 P,3 LB,1 LS,2 DB',
      '2 RB, 1 TE, 0 WR,1 P,3 LB,1 LS,3 DB',
      '2 RB, 1 TE, 0 WR,1 P,4 LB,1 LS,2 DB',
      '2 RB, 1 TE, 0 WR,2 LB,1 K,5 DB',
      '2 RB, 1 TE, 1 WR',
      '2 RB, 1 TE, 1 WR,1 DB',
      '2 RB, 1 TE, 1 WR,1 DL',
      '2 RB, 1 TE, 1 WR,1 LB',
      '2 RB, 1 TE, 1 WR,1 P,2 LB,1 LS,1 DL,2 DB',
      '2 RB, 1 TE, 1 WR,1 P,2 LB,1 LS,3 DB',
      '2 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,1 DB',
      '2 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,2 DB',
      '2 RB, 1 TE, 1 WR,1 P,4 LB,1 LS,1 DB',
      '2 RB, 1 TE, 2 WR',
      '2 RB, 1 TE, 2 WR,1 DB',
      '2 RB, 1 TE, 2 WR,1 DL',
      '2 RB, 1 TE, 2 WR,1 P,2 LB,1 LS,2 DB',
      '2 RB, 1 TE, 2 WR,1 P,3 LB,1 LS,1 DB',
      '2 RB, 1 TE, 3 WR',
      '2 RB, 1 TE, 3 WR,1 P',
      '2 RB, 1 TE, 4 WR',
      '2 RB, 2 TE, 0 WR',
      '2 RB, 2 TE, 0 WR,1 DB',
      '2 RB, 2 TE, 0 WR,1 DL',
      '2 RB, 2 TE, 0 WR,1 LB',
      '2 RB, 2 TE, 0 WR,1 P,2 LB,1 LS,3 DB',
      '2 RB, 2 TE, 0 WR,1 P,3 LB,1 LS,2 DB',
      '2 RB, 2 TE, 1 WR',
      '2 RB, 2 TE, 1 WR,1 DL',
      '2 RB, 2 TE, 1 WR,1 P,2 LB,1 LS,1 DL,1 DB',
      '2 RB, 2 TE, 1 WR,1 P,2 LB,1 LS,2 DB',
      '2 RB, 2 TE, 1 WR,1 P,3 LB,1 LS,1 DB',
      '2 RB, 2 TE, 1 WR,2 LB,1 DB',
      '2 RB, 2 TE, 2 WR',
      '2 RB, 2 TE, 3 WR',
      '2 RB, 2 TE, 3 WR,1 P,3 LB,1 LS,3 DB',
      '2 RB, 2 TE, 4 WR',
      '2 RB, 2 TE, 5 WR',
      '2 RB, 3 TE, 0 WR',
      '2 RB, 3 TE, 0 WR,1 DL',
      '2 RB, 3 TE, 1 WR',
      '2 RB, 3 TE, 2 WR',
      '2 RB, 3 TE, 4 WR',
      '3 QB, 1 RB, 1 TE, 1 WR',
      '3 RB, 0 TE, 0 WR,1 P,4 LB,1 LS,2 DB',
      '3 RB, 0 TE, 1 WR,1 P,2 LB,1 LS,1 DL,2 DB',
      '3 RB, 0 TE, 1 WR,1 P,3 LB,1 LS,2 DB',
      '3 RB, 0 TE, 1 WR,1 P,4 LB,1 LS,1 DB',
      '3 RB, 0 TE, 2 WR',
      '3 RB, 0 TE, 3 WR',
      '3 RB, 0 TE, 4 WR',
      '3 RB, 1 TE, 0 WR,1 P,3 LB,1 LS,2 DB',
      '3 RB, 1 TE, 1 WR',
      '3 RB, 1 TE, 1 WR,1 P,2 LB,1 LS,2 DB',
      '3 RB, 1 TE, 1 WR,1 P,3 LB,1 LS,1 DB',
      '3 RB, 1 TE, 2 WR',
      '3 RB, 1 TE, 3 WR',
      '3 RB, 2 TE, 0 WR',
      '3 RB, 2 TE, 0 WR,1 P,1 LB,1 LS,1 DL,2 DB',
      '3 RB, 2 TE, 1 WR,1 P,2 LB',
      '3 RB, 3 TE, 3 WR',
      '4 RB, 0 TE, 1 WR',
      '4 RB, 1 TE, 0 WR',
      '6 OL, 0 RB, 0 TE, 0 WR,1 P,1 LB,1 LS,1 DL,1 K',
      '6 OL, 0 RB, 0 TE, 0 WR,1 P,1 LS,2 DL,1 K',
      '6 OL, 0 RB, 0 TE, 0 WR,2 P,1 LS,2 DL',
      '6 OL, 0 RB, 0 TE, 0 WR,4 DL',
      '6 OL, 0 RB, 0 TE, 3 WR,1 DL',
      '6 OL, 0 RB, 0 TE, 4 WR',
      '6 OL, 0 RB, 1 TE, 0 WR,1 P,1 LB,1 LS,1 K',
      '6 OL, 0 RB, 1 TE, 0 WR,1 P,1 LS,1 DL,1 K',
      '6 OL, 0 RB, 1 TE, 0 WR,2 P,1 LB,1 LS',
      '6 OL, 0 RB, 1 TE, 3 WR',
      '6 OL, 0 RB, 2 TE, 0 WR,1 LS,1 K',
      '6 OL, 0 RB, 2 TE, 0 WR,1 P,1 DL,1 K',
      '6 OL, 0 RB, 2 TE, 0 WR,1 P,1 LS,1 K',
      '6 OL, 0 RB, 2 TE, 0 WR,2 P,1 LS',
      '6 OL, 0 RB, 2 TE, 2 WR',
      '6 OL, 0 RB, 3 TE, 1 WR',
      '6 OL, 1 RB, 0 TE, 0 WR,1 P,1 LB,1 LS,1 DL',
      '6 OL, 1 RB, 0 TE, 0 WR,1 P,1 LS,1 DL,1 K',
      '6 OL, 1 RB, 0 TE, 2 WR,1 DL',
      '6 OL, 1 RB, 0 TE, 2 WR,1 LB',
      '6 OL, 1 RB, 0 TE, 3 WR',
      '6 OL, 1 RB, 1 TE, 0 WR,1 LB,1 DB',
      '6 OL, 1 RB, 1 TE, 0 WR,1 P,1 LS,1 K',
      '6 OL, 1 RB, 1 TE, 0 WR,2 DL',
      '6 OL, 1 RB, 1 TE, 1 WR',
      '6 OL, 1 RB, 1 TE, 1 WR,1 DL',
      '6 OL, 1 RB, 1 TE, 1 WR,1 LB',
      '6 OL, 1 RB, 1 TE, 2 WR',
      '6 OL, 1 RB, 1 TE, 3 WR',
      '6 OL, 1 RB, 1 TE, 3 WR,1 DB',
      '6 OL, 1 RB, 2 TE, 0 WR',
      '6 OL, 1 RB, 2 TE, 0 WR,1 DB',
      '6 OL, 1 RB, 2 TE, 0 WR,1 DL',
      '6 OL, 1 RB, 2 TE, 0 WR,1 LB',
      '6 OL, 1 RB, 2 TE, 1 WR',
      '6 OL, 1 RB, 2 TE, 2 WR',
      '6 OL, 1 RB, 3 TE, 0 WR',
      '6 OL, 1 RB, 3 TE, 1 WR',
      '6 OL, 2 RB, 0 TE, 2 WR',
      '6 OL, 2 RB, 1 TE, 0 WR,1 DB',
      '6 OL, 2 RB, 1 TE, 0 WR,1 DL',
      '6 OL, 2 RB, 1 TE, 1 WR',
      '6 OL, 2 RB, 1 TE, 2 WR',
      '6 OL, 2 RB, 2 TE, 0 WR',
      '6 OL, 2 RB, 2 TE, 1 WR',
      '6 OL, 3 RB, 0 TE, 1 WR',
      '6 OL, 3 RB, 1 TE, 0 WR',
      '7 OL, 0 RB, 0 TE, 0 WR,1 P,1 LS,1 DL,1 K',
      '7 OL, 0 RB, 1 TE, 0 WR,1 P,1 DL,1 K',
      '7 OL, 0 RB, 1 TE, 0 WR,1 P,1 LS,1 K',
      '7 OL, 0 RB, 2 TE, 0 WR,1 DL',
      '7 OL, 0 RB, 2 TE, 0 WR,1 LS,1 K',
      '7 OL, 0 RB, 2 TE, 0 WR,1 P',
      '7 OL, 0 RB, 3 TE, 0 WR',
      '7 OL, 0 RB, 4 TE, 0 WR',
      '7 OL, 1 RB, 0 TE, 2 WR',
      '7 OL, 1 RB, 1 TE, 0 WR,1 DL',
      '7 OL, 1 RB, 1 TE, 0 WR,1 LB',
      '7 OL, 1 RB, 1 TE, 1 WR',
      '7 OL, 1 RB, 2 TE, 0 WR',
      '7 OL, 1 RB, 2 TE, 0 WR,1 DL',
      '7 OL, 1 RB, 3 TE, 0 WR',
      '7 OL, 2 RB, 0 TE, 1 WR',
      '7 OL, 2 RB, 1 TE, 0 WR',
      '7 OL, 2 RB, 2 TE, 0 WR',
      '7 OL, 2 RB, 2 TE, 2 WR,1 P,1 LS,2 DL',
      '8 OL, 1 RB, 0 TE, 1 WR',
      '8 OL, 1 RB, 1 TE, 0 WR',
      '8 OL, 2 RB, 0 TE, 0 WR'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },
  def_personnel: {
    values: [
      '0 DL, 0 LB, 0 DB',
      '0 DL, 0 LB, 0 DB, 1 RB,3 TE,1 QB,1 WR,5 OL',
      '0 DL, 1 LB, 4 DB, 1 RB,2 TE,2 WR',
      '0 DL, 2 LB, 2 DB, 2 RB,1 TE,4 WR',
      '0 DL, 2 LB, 3 DB, 2 RB,2 TE,2 WR',
      '0 DL, 2 LB, 3 DB, 3 RB,1 TE,2 WR',
      '0 DL, 2 LB, 4 DB, 1 RB,1 TE,3 WR',
      '0 DL, 2 LB, 4 DB, 3 RB,1 TE,1 WR',
      '0 DL, 2 LB, 4 DB, 3 RB,2 WR',
      '0 DL, 2 LB, 5 DB, 1 RB,1 TE,2 WR',
      '0 DL, 2 LB, 5 DB, 1 RB,2 TE,1 WR',
      '0 DL, 2 LB, 5 DB, 1 TE,3 WR',
      '0 DL, 2 LB, 5 DB, 2 RB,1 TE,1 WR',
      '0 DL, 2 LB, 5 DB, 2 RB,2 WR',
      '0 DL, 2 LB, 5 DB, 4 WR',
      '0 DL, 2 LB, 6 DB, 2 RB,1 TE',
      '0 DL, 2 LB, 6 DB, 2 RB,1 WR',
      '0 DL, 2 LB, 8 DB, 1 WR',
      '0 DL, 2 LB, 9 DB',
      '0 DL, 3 LB, 2 DB, 2 RB,1 TE,3 WR',
      '0 DL, 3 LB, 2 DB, 2 RB,2 TE,2 WR',
      '0 DL, 3 LB, 3 DB, 1 RB,1 TE,3 WR',
      '0 DL, 3 LB, 3 DB, 1 RB,3 TE,1 WR',
      '0 DL, 3 LB, 3 DB, 1 TE,4 WR',
      '0 DL, 3 LB, 3 DB, 2 RB,1 TE,1 WR,1 OL',
      '0 DL, 3 LB, 3 DB, 2 RB,1 TE,2 WR',
      '0 DL, 3 LB, 3 DB, 2 RB,2 TE,1 WR',
      '0 DL, 3 LB, 3 DB, 2 RB,3 WR',
      '0 DL, 3 LB, 4 DB, 1 RB,1 TE,2 WR',
      '0 DL, 3 LB, 4 DB, 1 RB,2 WR',
      '0 DL, 3 LB, 4 DB, 1 RB,3 WR',
      '0 DL, 3 LB, 4 DB, 1 TE,3 WR',
      '0 DL, 3 LB, 4 DB, 2 RB,1 TE,1 WR',
      '0 DL, 3 LB, 4 DB, 2 RB,2 WR',
      '0 DL, 3 LB, 4 DB, 2 TE,2 WR',
      '0 DL, 3 LB, 4 DB, 3 RB,1 QB',
      '0 DL, 3 LB, 4 DB, 3 RB,1 WR',
      '0 DL, 3 LB, 5 DB, 1 RB,1 TE,1 WR',
      '0 DL, 3 LB, 5 DB, 1 RB,2 WR',
      '0 DL, 3 LB, 5 DB, 1 TE,2 WR',
      '0 DL, 3 LB, 5 DB, 2 RB,1 WR',
      '0 DL, 3 LB, 5 DB, 2 TE,1 WR',
      '0 DL, 3 LB, 5 DB, 3 RB',
      '0 DL, 3 LB, 5 DB, 3 WR',
      '0 DL, 3 LB, 6 DB, 1 RB,1 TE',
      '0 DL, 3 LB, 6 DB, 1 RB,1 WR',
      '0 DL, 3 LB, 7 DB',
      '0 DL, 3 LB, 7 DB, 1 RB',
      '0 DL, 3 LB, 7 DB, 1 WR',
      '0 DL, 3 LB, 8 DB',
      '0 DL, 4 LB, 2 DB, 2 RB,3 WR',
      '0 DL, 4 LB, 3 DB, 1 RB,1 TE,2 WR',
      '0 DL, 4 LB, 3 DB, 1 RB,2 WR',
      '0 DL, 4 LB, 3 DB, 1 RB,3 TE',
      '0 DL, 4 LB, 3 DB, 1 TE,3 WR',
      '0 DL, 4 LB, 3 DB, 2 RB,1 TE,1 WR',
      '0 DL, 4 LB, 3 DB, 2 RB,2 WR',
      '0 DL, 4 LB, 4 DB, 1 RB,1 QB,1 WR',
      '0 DL, 4 LB, 4 DB, 1 RB,1 TE,1 WR',
      '0 DL, 4 LB, 4 DB, 1 RB,2 WR',
      '0 DL, 4 LB, 4 DB, 1 TE,1 WR',
      '0 DL, 4 LB, 4 DB, 1 TE,2 WR',
      '0 DL, 4 LB, 4 DB, 2 RB,1 WR',
      '0 DL, 4 LB, 4 DB, 3 WR',
      '0 DL, 4 LB, 5 DB, 1 RB,1 WR',
      '0 DL, 4 LB, 6 DB',
      '0 DL, 4 LB, 6 DB, 1 RB',
      '0 DL, 4 LB, 6 DB, 1 WR',
      '0 DL, 4 LB, 7 DB',
      '0 DL, 5 LB, 3 DB, 2 RB,1 WR',
      '0 DL, 5 LB, 4 DB, 1 RB,1 WR',
      '0 DL, 5 LB, 4 DB, 2 WR',
      '0 DL, 5 LB, 5 DB, 1 RB',
      '0 DL, 5 LB, 6 DB',
      '0 DL, 6 LB, 4 DB, 1 WR',
      '0 DL, 6 LB, 5 DB',
      '1 DL, 1 LB, 3 DB, 2 RB,1 TE,3 WR',
      '1 DL, 1 LB, 4 DB, 2 RB,1 TE,2 WR',
      '1 DL, 1 LB, 5 DB, 1 RB,1 TE,2 WR',
      '1 DL, 1 LB, 5 DB, 3 RB,1 TE',
      '1 DL, 1 LB, 6 DB, 2 RB,1 WR',
      '1 DL, 2 LB, 0 DB, 1 P,1 WR,3 OL',
      '1 DL, 2 LB, 2 DB, 3 RB,1 TE,2 WR',
      '1 DL, 2 LB, 3 DB, 2 RB,1 TE,2 WR',
      '1 DL, 2 LB, 3 DB, 2 RB,3 WR',
      '1 DL, 2 LB, 3 DB, 3 RB,2 WR',
      '1 DL, 2 LB, 4 DB, 1 RB,1 TE,2 WR',
      '1 DL, 2 LB, 4 DB, 1 RB,2 TE,1 WR',
      '1 DL, 2 LB, 4 DB, 2 RB,2 WR',
      '1 DL, 2 LB, 4 DB, 2 TE,2 WR',
      '1 DL, 2 LB, 4 DB, 3 RB,1 TE',
      '1 DL, 2 LB, 4 DB, 3 RB,1 WR',
      '1 DL, 2 LB, 5 DB, 1 RB,1 QB,1 WR',
      '1 DL, 2 LB, 5 DB, 1 RB,2 WR',
      '1 DL, 2 LB, 5 DB, 2 RB,1 WR',
      '1 DL, 2 LB, 7 DB',
      '1 DL, 2 LB, 7 DB, 1 RB',
      '1 DL, 2 LB, 7 DB, 1 TE',
      '1 DL, 2 LB, 7 DB, 1 WR',
      '1 DL, 2 LB, 8 DB',
      '1 DL, 3 LB, 2 DB, 2 RB,3 WR',
      '1 DL, 3 LB, 3 DB, 1 RB,1 TE,2 WR',
      '1 DL, 3 LB, 3 DB, 3 RB,1 WR',
      '1 DL, 3 LB, 4 DB, 1 RB,1 QB,1 WR',
      '1 DL, 3 LB, 4 DB, 1 RB,1 TE,1 WR',
      '1 DL, 3 LB, 4 DB, 1 RB,2 WR',
      '1 DL, 3 LB, 4 DB, 1 TE,2 WR',
      '1 DL, 3 LB, 4 DB, 2 RB,1 WR',
      '1 DL, 3 LB, 5 DB, 1 RB,1 WR',
      '1 DL, 3 LB, 5 DB, 1 TE,1 WR',
      '1 DL, 3 LB, 5 DB, 2 RB',
      '1 DL, 3 LB, 5 DB, 2 WR',
      '1 DL, 3 LB, 6 DB',
      '1 DL, 3 LB, 6 DB, 1 OL',
      '1 DL, 3 LB, 6 DB, 1 RB',
      '1 DL, 3 LB, 6 DB, 1 TE',
      '1 DL, 3 LB, 6 DB, 1 WR',
      '1 DL, 3 LB, 7 DB',
      '1 DL, 4 LB, 3 DB, 1 RB,2 WR',
      '1 DL, 4 LB, 4 DB, 1 QB,1 WR',
      '1 DL, 4 LB, 5 DB',
      '1 DL, 4 LB, 5 DB, 1 OL',
      '1 DL, 4 LB, 5 DB, 1 RB',
      '1 DL, 4 LB, 5 DB, 1 WR',
      '1 DL, 4 LB, 6 DB',
      '1 DL, 4 LB, 7 DB',
      '1 DL, 5 LB, 4 DB',
      '1 DL, 5 LB, 4 DB, 1 TE',
      '1 DL, 5 LB, 4 DB, 1 WR',
      '1 DL, 5 LB, 5 DB',
      '1 DL, 5 LB, 5 DB, 1 WR',
      '1 DL, 5 LB, 6 DB',
      '1 DL, 6 LB, 4 DB',
      '2 DL, 1 LB, 3 DB, 1 RB,2 TE,2 WR',
      '2 DL, 1 LB, 4 DB, 1 RB,3 WR',
      '2 DL, 1 LB, 5 DB, 2 RB,1 TE',
      '2 DL, 1 LB, 7 DB',
      '2 DL, 1 LB, 7 DB, 1 TE',
      '2 DL, 1 LB, 8 DB',
      '2 DL, 2 LB, 2 DB, 2 RB,3 WR',
      '2 DL, 2 LB, 4 DB, 1 RB,1 QB,1 WR',
      '2 DL, 2 LB, 4 DB, 1 RB,2 WR',
      '2 DL, 2 LB, 4 DB, 1 TE,2 WR',
      '2 DL, 2 LB, 4 DB, 3 WR',
      '2 DL, 2 LB, 5 DB',
      '2 DL, 2 LB, 5 DB, 1 RB,1 WR',
      '2 DL, 2 LB, 6 DB',
      '2 DL, 2 LB, 6 DB, 1 OL',
      '2 DL, 2 LB, 6 DB, 1 RB',
      '2 DL, 2 LB, 6 DB, 1 TE',
      '2 DL, 2 LB, 6 DB, 1 WR',
      '2 DL, 2 LB, 7 DB',
      '2 DL, 3 LB, 3 DB, 1 RB,2 WR',
      '2 DL, 3 LB, 4 DB',
      '2 DL, 3 LB, 4 DB, 1 RB,1 WR',
      '2 DL, 3 LB, 4 DB, 2 WR',
      '2 DL, 3 LB, 5 DB',
      '2 DL, 3 LB, 5 DB, 1 OL',
      '2 DL, 3 LB, 5 DB, 1 QB',
      '2 DL, 3 LB, 5 DB, 1 RB',
      '2 DL, 3 LB, 5 DB, 1 TE',
      '2 DL, 3 LB, 5 DB, 1 WR',
      '2 DL, 3 LB, 6 DB',
      '2 DL, 3 LB, 7 DB',
      '2 DL, 4 LB, 2 DB, 1 RB,1 TE,1 WR',
      '2 DL, 4 LB, 4 DB',
      '2 DL, 4 LB, 4 DB, 1 OL',
      '2 DL, 4 LB, 4 DB, 1 QB',
      '2 DL, 4 LB, 4 DB, 1 RB',
      '2 DL, 4 LB, 4 DB, 1 WR',
      '2 DL, 4 LB, 5 DB',
      '2 DL, 4 LB, 5 DB, 1 OL',
      '2 DL, 4 LB, 5 DB, 1 RB',
      '2 DL, 4 LB, 5 DB, 1 WR',
      '2 DL, 4 LB, 6 DB',
      '2 DL, 5 LB, 3 DB, 1 OL',
      '2 DL, 5 LB, 3 DB, 1 QB',
      '2 DL, 5 LB, 3 DB, 1 WR',
      '2 DL, 5 LB, 4 DB',
      '2 DL, 5 LB, 5 DB',
      '2 DL, 5 LB, 6 DB',
      '2 DL, 6 LB, 3 DB',
      '3 DL, 0 LB, 8 DB',
      '3 DL, 1 LB, 3 DB, 2 RB,2 WR',
      '3 DL, 1 LB, 5 DB, 1 DT/DE,1 OL',
      '3 DL, 1 LB, 5 DB, 1 TE,1 WR',
      '3 DL, 1 LB, 6 DB',
      '3 DL, 1 LB, 6 DB, 1 OL',
      '3 DL, 1 LB, 6 DB, 1 TE',
      '3 DL, 1 LB, 6 DB, 1 WR',
      '3 DL, 1 LB, 7 DB',
      '3 DL, 2 LB, 3 DB, 1 RB,2 WR',
      '3 DL, 2 LB, 4 DB',
      '3 DL, 2 LB, 4 DB, 1 RB,1 WR',
      '3 DL, 2 LB, 4 DB, 1 TE',
      '3 DL, 2 LB, 4 DB, 1 TE,1 WR',
      '3 DL, 2 LB, 5 DB',
      '3 DL, 2 LB, 5 DB, 1 OL',
      '3 DL, 2 LB, 5 DB, 1 QB',
      '3 DL, 2 LB, 5 DB, 1 RB',
      '3 DL, 2 LB, 5 DB, 1 TE',
      '3 DL, 2 LB, 5 DB, 1 WR',
      '3 DL, 2 LB, 6 DB',
      '3 DL, 2 LB, 7 DB',
      '3 DL, 3 LB, 3 DB',
      '3 DL, 3 LB, 3 DB, 1 RB',
      '3 DL, 3 LB, 3 DB, 1 RB,1 WR',
      '3 DL, 3 LB, 4 DB',
      '3 DL, 3 LB, 4 DB, 1 OL',
      '3 DL, 3 LB, 4 DB, 1 QB',
      '3 DL, 3 LB, 4 DB, 1 RB',
      '3 DL, 3 LB, 4 DB, 1 TE',
      '3 DL, 3 LB, 4 DB, 1 WR',
      '3 DL, 3 LB, 5 DB',
      '3 DL, 3 LB, 5 DB, 1 RB',
      '3 DL, 3 LB, 5 DB, 1 TE',
      '3 DL, 3 LB, 5 DB, 1 WR',
      '3 DL, 3 LB, 6 DB',
      '3 DL, 4 LB, 3 DB',
      '3 DL, 4 LB, 3 DB, 1 OL',
      '3 DL, 4 LB, 3 DB, 1 QB',
      '3 DL, 4 LB, 3 DB, 1 RB',
      '3 DL, 4 LB, 3 DB, 1 WR',
      '3 DL, 4 LB, 4 DB',
      '3 DL, 4 LB, 4 DB, 1 OL',
      '3 DL, 4 LB, 4 DB, 1 RB',
      '3 DL, 4 LB, 4 DB, 1 TE',
      '3 DL, 4 LB, 4 DB, 1 WR',
      '3 DL, 4 LB, 5 DB',
      '3 DL, 4 LB, 6 DB, 1 WR',
      '3 DL, 5 LB, 2 DB',
      '3 DL, 5 LB, 2 DB, 1 OL',
      '3 DL, 5 LB, 2 DB, 1 QB',
      '3 DL, 5 LB, 3 DB',
      '3 DL, 5 LB, 4 DB',
      '3 DL, 5 LB, 5 DB',
      '3 DL, 6 LB, 2 DB',
      '4 DL, 0 LB, 7 DB',
      '4 DL, 1 LB, 4 DB, 1 QB,1 WR',
      '4 DL, 1 LB, 4 DB, 1 RB',
      '4 DL, 1 LB, 5 DB',
      '4 DL, 1 LB, 5 DB, 1 OL',
      '4 DL, 1 LB, 5 DB, 1 RB',
      '4 DL, 1 LB, 5 DB, 1 TE',
      '4 DL, 1 LB, 5 DB, 1 WR',
      '4 DL, 1 LB, 6 DB',
      '4 DL, 1 LB, 8 DB',
      '4 DL, 2 LB, 3 DB',
      '4 DL, 2 LB, 3 DB, 1 OL',
      '4 DL, 2 LB, 3 DB, 1 WR,1 OL',
      '4 DL, 2 LB, 4 DB',
      '4 DL, 2 LB, 4 DB, 1 OL',
      '4 DL, 2 LB, 4 DB, 1 RB',
      '4 DL, 2 LB, 4 DB, 1 TE',
      '4 DL, 2 LB, 4 DB, 1 WR',
      '4 DL, 2 LB, 5 DB',
      '4 DL, 2 LB, 5 DB, 1 OL',
      '4 DL, 2 LB, 5 DB, 1 RB',
      '4 DL, 2 LB, 5 DB, 1 TE',
      '4 DL, 2 LB, 5 DB, 1 WR',
      '4 DL, 2 LB, 6 DB',
      '4 DL, 2 LB, 7 DB',
      '4 DL, 3 LB, 2 DB, 1 WR',
      '4 DL, 3 LB, 3 DB',
      '4 DL, 3 LB, 3 DB, 1 OL',
      '4 DL, 3 LB, 3 DB, 1 QB',
      '4 DL, 3 LB, 3 DB, 1 RB',
      '4 DL, 3 LB, 3 DB, 1 WR',
      '4 DL, 3 LB, 4 DB',
      '4 DL, 3 LB, 4 DB, 1 OL',
      '4 DL, 3 LB, 4 DB, 1 RB',
      '4 DL, 3 LB, 4 DB, 1 RB,1 WR',
      '4 DL, 3 LB, 4 DB, 1 TE',
      '4 DL, 3 LB, 4 DB, 1 WR',
      '4 DL, 3 LB, 5 DB',
      '4 DL, 3 LB, 6 DB, 1 RB',
      '4 DL, 4 LB, 2 DB',
      '4 DL, 4 LB, 2 DB, 1 RB',
      '4 DL, 4 LB, 3 DB',
      '4 DL, 4 LB, 4 DB',
      '4 DL, 4 LB, 5 DB',
      '4 DL, 4 LB, 6 DB',
      '4 DL, 5 LB, 1 DB',
      '4 DL, 5 LB, 1 DB, 1 OL',
      '4 DL, 5 LB, 2 DB',
      '4 DL, 5 LB, 3 DB',
      '4 DL, 6 LB, 1 DB',
      '5 DL, 0 LB, 6 DB',
      '5 DL, 1 LB, 3 DB, 2 WR',
      '5 DL, 1 LB, 4 DB',
      '5 DL, 1 LB, 4 DB, 1 RB',
      '5 DL, 1 LB, 4 DB, 1 WR',
      '5 DL, 1 LB, 5 DB',
      '5 DL, 1 LB, 5 DB, 1 RB',
      '5 DL, 1 LB, 6 DB',
      '5 DL, 2 LB, 2 DB, 1 RB,1 WR',
      '5 DL, 2 LB, 3 DB',
      '5 DL, 2 LB, 3 DB, 1 OL',
      '5 DL, 2 LB, 3 DB, 1 QB',
      '5 DL, 2 LB, 3 DB, 1 RB',
      '5 DL, 2 LB, 3 DB, 1 WR',
      '5 DL, 2 LB, 4 DB',
      '5 DL, 2 LB, 5 DB',
      '5 DL, 2 LB, 6 DB',
      '5 DL, 3 LB, 2 DB',
      '5 DL, 3 LB, 2 DB, 1 OL',
      '5 DL, 3 LB, 2 DB, 1 WR',
      '5 DL, 3 LB, 3 DB',
      '5 DL, 3 LB, 4 DB',
      '5 DL, 3 LB, 5 DB',
      '5 DL, 4 LB, 1 DB, 1 OL',
      '5 DL, 4 LB, 2 DB',
      '5 DL, 4 LB, 3 DB',
      '5 DL, 5 LB, 1 DB',
      '5 DL, 5 LB, 2 DB',
      '6 DL, 1 LB, 4 DB',
      '6 DL, 1 LB, 5 DB',
      '6 DL, 2 LB, 2 DB',
      '6 DL, 2 LB, 3 DB',
      '6 DL, 2 LB, 4 DB',
      '6 DL, 2 LB, 6 DB',
      '6 DL, 3 LB, 1 DB',
      '6 DL, 3 LB, 2 DB',
      '6 DL, 3 LB, 3 DB',
      '6 DL, 3 LB, 4 DB',
      '6 DL, 3 LB, 5 DB',
      '6 DL, 4 LB, 1 DB',
      '6 DL, 4 LB, 2 DB',
      '6 DL, 5 LB, 0 DB',
      '7 DL, 1 LB, 3 DB',
      '7 DL, 2 LB, 2 DB',
      '7 DL, 2 LB, 7 DB',
      '7 DL, 3 LB, 1 DB',
      '7 DL, 5 LB, 5 DB, 1 WR'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.FORMATION_PERSONNEL]
  },

  box_ngs: {
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
  pru_ngs: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  air_yards_ngs: {
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
  // TODO allow decimal precision for time_to_throw_ngs
  time_to_throw_ngs: {
    min: 0,
    max: 30,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  route_ngs: {
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
  man_zone_ngs: {
    values: ['MAN_COVERAGE', 'ZONE_COVERAGE'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.COVERAGE]
  },
  cov_type_ngs: {
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
    values: constants.quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.DRIVE]
  },
  drive_end_qtr: {
    values: constants.quarters,
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
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_OUTCOME]
  },

  play_clock: {
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
    min: 0,
    max: 900,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  sec_rem_half: {
    min: 0,
    max: 1800,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  sec_rem_gm: {
    min: 0,
    max: 3600,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  pos_team: {
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  off: {
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  def: {
    values: constants.nflTeams,
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
  succ: {
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
    values: constants.nflTeams,
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
  qb_pressure_ngs: {
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
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  avsk: {
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
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  box_defenders: {
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
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  pass_rushers: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  blitzers: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.DEFENSE]
  },
  db_blitzers: {
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
    min: -4,
    max: 7,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.EXPECTED_POINTS]
  },
  epa: {
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
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  away_wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_home_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  home_wp_post: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  away_wp_post: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.WIN_PROBABILITY]
  },
  vegas_home_wp: {
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
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.RECEIVING]
  },
  xyac_fd_prob: {
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
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  away_to_rem: {
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  pos_to_rem: {
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },
  def_to_rem: {
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
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    groups: [COLUMN_PARAM_GROUPS.PLAY_TIMEOUT]
  },

  home_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  away_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  pos_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  def_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  score_diff: {
    min: -70,
    max: 70,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE],
    preset_values: score_diff_preset_values
  },
  pos_score_post: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  def_score_post: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.SCORE]
  },
  score_diff_post: {
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
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },
  pass_oe: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PLAY_SITUATION]
  },

  cp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  },
  cpoe: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    groups: [COLUMN_PARAM_GROUPS.PASSING]
  }
}
