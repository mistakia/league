import * as table_constants from 'react-table/src/constants.mjs'
import * as constants from './constants.mjs'

export default {
  career_year: {
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    min: 1,
    max: 25
  },
  career_game: {
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    min: 1,
    max: 500
  },
  week: {
    values: constants.nfl_weeks,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  dwn: {
    values: constants.downs,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  qtr: {
    values: constants.quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  year: {
    values: constants.years,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  year_offset: {
    data_type: table_constants.TABLE_DATA_TYPES.RANGE,
    label: 'Year + N',
    min: -30,
    max: 30,
    default_value: 0,
    is_single: true,
    enable_on_splits: ['year']
  },
  // TODO
  // seas_type: {
  //   values: constants.seas_types,
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  ydl_num: {
    min: 1,
    max: 50,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  starting_hash: {
    values: ['RIGHT', 'MIDDLE', 'LEFT'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  motion: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  yards_to_go: {
    min: 0,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  // TODO data missing
  // yfog: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  off_formation: {
    values: [
      'SHOTGUN',
      'SINGLEBACK',
      'I_FORM',
      'EMPTY',
      'JUMBO',
      'PISTOL',
      'WILDCAT'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  box_ngs: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  pru_ngs: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  air_yards_ngs: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  // TODO allow decimal precision for time_to_throw_ngs
  time_to_throw_ngs: {
    min: 0,
    max: 30,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  man_zone_ngs: {
    values: ['MAN_COVERAGE', 'ZONE_COVERAGE'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  drive_seq: {
    min: 1,
    max: 50,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  drive_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  drive_play_count: {
    min: 0,
    max: 30,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  // TODO change format to allow for range
  // drive_top: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  drive_fds: {
    min: 0,
    max: 20,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  drive_inside20: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  drive_score: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  drive_start_qtr: {
    values: constants.quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  drive_end_qtr: {
    values: constants.quarters,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  drive_yds_penalized: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
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
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
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
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  series_suc: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  series_result: {
    values: [
      'END_HALF',
      'FIELD_GOAL',
      'FIRST_DOWN',
      'MISSED_FG',
      'OPP_TOUCHDOWN',
      'PUNT',
      'QB_KNEEL',
      'SAFETY',
      'TOUCHDOWN',
      'TURNOVER',
      'TURNOVER_ON_DOWNS'
    ],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  goal_to_go: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  score: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  score_type: {
    values: ['FG', 'PAT', 'PAT2', 'SFTY', 'TD'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  score_team: {
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  play_clock: {
    min: 0,
    max: 90, // TODO figure out why this is so high
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  sec_rem_half: {
    min: 0,
    max: 1800,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  sec_rem_gm: {
    min: 0,
    max: 3600,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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

  play_type: {
    values: ['CONV', 'FGXP', 'KOFF', 'NOPL', 'PASS', 'PUNT', 'RUSH'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
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

  yds_gained: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  fum: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  fuml: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  int: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  sk: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  succ: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  comp: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  incomp: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  trick_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  touchback: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  safety: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  penalty: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  oob: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  tfl: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  solo_tk: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  assist_tk: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  special: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  // TODO look into this
  // special_play_type: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  pen_team: {
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  pen_yds: {
    min: 0,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  ret_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  pass_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  rush_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  // TODO look into this
  // td_tm: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  pass_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  recv_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  rush_yds: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  dot: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  true_air_yards: {
    min: -40,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  yards_after_catch: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  yards_after_any_contact: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  ret_yds: {
    min: -100,
    max: 120,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  // ret_tm: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },

  no_huddle: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  play_action: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_dropback: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_kneel: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_spike: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_sneak: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_scramble: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  qb_pressure: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_pressure_ngs: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_hit: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_hurry: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  int_worthy: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  catchable_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  throw_away: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  shovel_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  sideline_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  highlight_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  dropped_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  contested_ball: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  created_reception: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  mbt: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  avsk: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  run_location: {
    values: ['left', 'right', 'middle'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  run_gap: {
    values: ['end', 'tackle', 'guard'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  trick_look: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  first_down: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  first_down_rush: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  first_down_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  first_down_penalty: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  third_down_converted: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  third_down_failed: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  fourth_down_converted: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  fourth_down_failed: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  hindered_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  zero_blitz: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  stunt: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  out_of_pocket_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  phyb: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  batted_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  screen_pass: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  pain_free_play: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  run_play_option: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_fault_sack: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  qb_position: {
    values: ['UNDER_CENTER', 'SHOTGUN', 'PISTOL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  read_thrown: {
    values: ['FIRST', 'SECOND', 'DESIGNED', 'CHECKDOWN', 'SCRAMBLE_DRILL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  n_offense_backfield: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  // TODO
  // ttscrm: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  time_to_pass: {
    min: 0,
    max: 15,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  // TODO
  // ttsk: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  time_to_pressure: {
    min: 0,
    max: 15,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
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
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  box: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  boxdb: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  pass_rushers: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  blitzers: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  db_blitzers: {
    min: 0,
    max: 11,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  oopd: {
    values: ['C', 'P', 'D', 'DR', 'BT', 'BL'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  cov: {
    values: [0, 1, 2],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  ep: {
    min: -4,
    max: 7,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  epa: {
    min: -14,
    max: 14,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  ep_succ: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  total_home_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_rush_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_rush_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_pass_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_pass_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  qb_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  comp_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  comp_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  xyac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_comp_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_comp_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_comp_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_comp_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_raw_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_raw_air_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_raw_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_raw_yac_epa: {
    min: -80,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  home_wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  away_wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  vegas_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  vegas_home_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  home_wp_post: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  away_wp_post: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  vegas_wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  vegas_home_wp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_rush_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_rush_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_pass_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_pass_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  comp_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  comp_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_comp_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_comp_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_comp_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_comp_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_raw_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_raw_air_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_home_raw_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  total_away_raw_yac_wpa: {
    min: -1,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  xyac_mean_yds: {
    min: 0,
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  xyac_median_yds: {
    min: 0,
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  xyac_succ_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  xyac_fd_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  ep_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  two_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  fg_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  kickoff_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  punt_att: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  fg_result: {
    values: ['blocked', 'made', 'missed'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  kick_distance: {
    min: 0, // TODO figure out why there is a play with -1
    max: 100,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  ep_result: {
    values: ['blocked', 'failed', 'good'],
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },
  // TODO change to boolean
  // tp_result: {
  //   data_type: table_constants.TABLE_DATA_TYPES.SELECT
  // },
  punt_blocked: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },

  home_to_rem: {
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  away_to_rem: {
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  pos_to_rem: {
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  def_to_rem: {
    min: 0,
    max: 3,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  to: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  to_team: {
    values: constants.nflTeams,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT
  },

  home_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  away_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  pos_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  def_score: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  score_diff: {
    min: -70,
    max: 70,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  pos_score_post: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  def_score_post: {
    min: 0,
    max: 80,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  score_diff_post: {
    min: -70,
    max: 70,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  no_score_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  opp_fg_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  opp_safety_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  opp_td_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  fg_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  safety_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  td_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  extra_point_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  two_conv_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  xpass_prob: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  pass_oe: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },

  cp: {
    min: 0,
    max: 1,
    step: 0.01,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  },
  cpoe: {
    min: -99,
    max: 99,
    data_type: table_constants.TABLE_DATA_TYPES.RANGE
  }
}
