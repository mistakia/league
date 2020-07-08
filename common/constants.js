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

const getAvailableYears = () => {
  const arr = []
  for (let i = year; i >= 2000; i--) {
    arr.push(i)
  }
  return arr
}
export const years = getAvailableYears()
export const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
export const nflWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
export const days = ['WED', 'THU', 'TN', 'FRI', 'SAT', 'SUN', 'MN', 'SN']
export const quarters = [1, 2, 3, 4, 5]
export const downs = ['1', '2', '3', '4']
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

export const fullStats = [
  // ////// PASSING ////////
  // basic
  'pc_pct',
  'py_pg',

  'tdp_pct',
  'ints_pct',

  // productivity
  'psucc',

  // accuracy
  'intw',
  'intw_pct',
  'drppy', // dropped passing yards
  'drptdp', // dropped passing touchdowns
  'high', // highlight pass
  'drpp', // dropped pass

  // advanced
  'ptay', // total air yards
  'pcay', // completed air yards
  'pyac', // yards after catch
  'pcay_pc', // completed air yards per completion
  'pyac_pc',
  '_ypa',
  '_aypa', // air yards per attempt
  '_adjypa',
  '_ypc',
  '_ypg',
  '_pacr',
  '_apacr',
  'pdot', // depth of target
  'pdot_pa', // average depth of taget
  'padot', // adj. depth of target**

  // pressure
  'sk',
  'sky', // sack yards
  'sk_pct',
  'qbp', // pressure
  'qbp_pct',
  'qbhi', // hit
  'qbhi_pct',
  'qbhu', // hurry
  'qbhu_pct',
  '_nygpa', // net yards gained per attempt: (py - sky) / (pa + sk)

  // ////// RECEIVING ////////
  // basic
  'recy_prec',
  'recy_pg',
  'ryac', // yards after catch
  'drprecy', // dropped receiving yards

  // reliability
  'drp',
  'cnb',

  // share
  '_strtay', // share of team total air yards
  '_sttrg', // share of team targets

  // usage
  'dptrg', // deep target
  'dptrg_pct', // deep pass percentage
  'rdot', // depth of target
  'rdot_ptrg', // average depth of target

  // advanced
  'rtay', // total air yards
  'rcay', // completed air yards
  '_ayps', // air yards per snap
  '_ayprec', // air yards per reception
  '_ayptrg', // air yards per target
  '_recypay', // receiving yards per air yard
  '_recypsnp', // receiving yards per snap
  '_recyprec', // receiving yards per reception
  '_recyptrg', // receiving yards per target
  '_wopr', // (1.5 x _sttrg + 0.7 x _sttay)
  '_ryacprec', // yac per rec

  // ////// RUSHING ////////
  // basic
  'ryaco', // rushing yards after contact
  'ryaco_pra', // rushing yards after contact per attempt
  'ry_pg',
  'ry_pra',
  'posra', // positive rush
  'rasucc', // successful rush
  'rfd', // rushing first down

  // advanced
  'mbt',
  'mbt_pt', // broken tackles per touch
  '_fumlpra', // fumbles per rushing attempt
  'rasucc_pra', // successful rush per attempt
  'posra_pra', // possitive rush per attempt

  // usage
  '_stra', // share of team rushing attempts
  '_stry', // share of team rushing yards

  // general
  '_tch',
  'fd', // first down
  'succ',
  'fd_pct', // first down pct*
  ...stats
]

export const createFullStats = () => fullStats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

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

  TRADE: 4,

  POACHED: 5,

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

  4: 'Traded',

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
