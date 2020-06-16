import moment from 'moment'
// eslint-disable-next-line
import * as espn from './espn-constants'
export { espn }

export const start = moment('9/1', 'M/D')
const diff = moment().diff(start, 'weeks')
export const week = diff < 0 ? 0 : diff

export const year = moment().month() > 2
  ? moment().year()
  : moment().year() - 1

export const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
export const stats = [
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',

  'ra',
  'ry',
  'tdr',
  'fuml',

  'trg',
  'rec',
  'recy',
  'tdrec',

  'snp',

  'twoptc'
]

export const slots = {
  QB_ONE: 0,
  QB_TWO: 1,
  RB_ONE: 2,
  RB_TWO: 3,
  RB_THREE: 4,
  WR_ONE: 5,
  WR_TWO: 6,
  WR_THREE: 7,
  TE_ONE: 8,
  TE_TWO: 9,
  WRTE_ONE: 10,
  RBWR_ONE: 11,
  RBWR_TWO: 12,
  RBWRTE_ONE: 13,
  RBWRTE_TWO: 14,
  QBRBWRTE_ONE: 15,
  K_ONE: 16,
  DST_ONE: 17,
  IR_ONE: 18,
  IR_TWO: 19,
  IR_THREE: 20,
  PS_ONE: 21,
  PS_TWO: 22,
  PS_THREE: 23,
  PS_FOUR: 24,
  PS_FIVE: 25,
  PS_SIX: 26,
  BENCH_ONE: 27,
  BENCH_TWO: 28,
  BENCH_THREE: 29,
  BENCH_FOUR: 30,
  BENCH_FIVE: 31,
  BENCH_SIX: 32,
  BENCH_SEVEN: 33,
  BENCH_EIGHT: 34,
  BENCH_NINE: 35
}

export const transactions = {
  ROSTER_ADD: 0,
  ROSTER_DROP: 1,

  ROSTER_ACTIVATE: 2,
  ROSTER_DEACTIVATE: 3,
  POACH_CLAIM: 4,
  POACH_PROCESSED: 5,

  AUCTION_BID: 6,
  AUCTION_PROCESSED: 7,

  DRAFT: 8,

  EXTENSION: 9,
  TRANSITION_TAG: 10,
  FRANCHISE_TAG: 11,
  ROOKIE_TAG: 12
}

export const transactionsDetail = {
  0: 'Added',
  1: 'Dropped',

  2: 'Activated',
  3: 'Deactivated',
  4: 'Poach Claim',
  5: 'Poached',

  6: 'Bid',
  7: 'Signed',

  8: 'Drafted',

  9: 'Extended',
  10: 'Tran. Tagged',
  11: 'Fran. Tagged',
  12: 'Rookie Tagged'
}

export const nflTeams = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAC',
  'KC',
  'LA',
  'LAC',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WAS'
]
