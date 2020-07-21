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

const passingQualifier = {
  type: 'pa',
  value: 14
}

const rushingQualifier = {
  type: 'ra',
  value: 8
}

const receivingQualifier = {
  type: 'trg',
  value: 8
}

export const qualifiers = {
  pc_pct: passingQualifier,
  tdp_pct: passingQualifier,
  ints_pct: passingQualifier,
  psucc: passingQualifier,
  intw_pct: passingQualifier,
  pcay_pc: passingQualifier,
  pyac_pc: passingQualifier,
  _ypa: passingQualifier,
  _aypa: passingQualifier,
  _adjypa: passingQualifier,
  _ypc: passingQualifier,
  _pacr: passingQualifier,
  _apacr: passingQualifier,
  pdot_pa: passingQualifier,

  recy_prec: receivingQualifier,
  dptrg_pct: receivingQualifier,
  rdot_ptrg: receivingQualifier,
  _ayps: receivingQualifier,
  _ayprec: receivingQualifier,
  _ayptrg: receivingQualifier,
  _recypay: receivingQualifier,
  _recypsnp: receivingQualifier,
  _recyprec: receivingQualifier,
  _recyptrg: receivingQualifier,
  _ryacprec: receivingQualifier,

  ryaco_pra: rushingQualifier,
  ry_pra: rushingQualifier,
  rasucc: rushingQualifier,
  mbt_pt: rushingQualifier,
  _fumlpra: rushingQualifier,
  rasucc_pra: rushingQualifier,
  posra_pra: rushingQualifier
}

export const createFullStats = () => fullStats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

export const teamStats = [
  'q1p', // quarter 1 points
  'q2p', // quarter 2 points
  'q3p', // quarter 3 points
  'q4p', // quarter 4 points
  'rfd', // rushing first downs
  'pfd', // passing first downs
  'ry', // rushing yards
  'ra', // rushing attempts
  'py', // passing attempts
  'pa', // passing yards
  'tdr', // rushing touchdowns
  'tdp', // passing touchdowns
  'bpy', // big play passing yards
  'srp', // successful rush plays
  'spp', // successful pass plays
  'qba', // qb rushing attempts
  'qby', // qb rushing yards
  'ley', // LE rushing yards
  'lty', // LT rushing yards
  'lgy', // LG rushign yards
  'mdy', // middle rushing yards
  'rgy', // RG rushing yards
  'rty', // RT rushing yards
  'rey', // RE rushing yards
  'sla', // short left passing attempts
  'sly', // short left passing yards
  'sma', // short middle passing attempts
  'smy', // short middle passing yards
  'sra', // short right passing attempts
  'sry', // short right passing yards
  'dla', // deep left passing attempts
  'dly', // deep left passing yards
  'dma', // deep middle passing attempts
  'dmy', // deep middle passing yards
  'dra', // deep right passing attempts
  'dry', // deep right passing yards
  'wr1a', // wr1/2 passing attempts
  'wr1y', // wr1/2 passing yards
  'wr3a', // wr3+ passing attempts
  'wr3y', // wr3+ passing yards
  'tea', // te passing attempts
  'tey', // te passing yards
  'rba', // rb passing attempts
  'rby', // rb passing yards
  'sga', // shotgun attempts
  'sgy', // shotgun yards
  'spc', // short comp
  'mpc', // medium comp
  'lpc', // long comp
  'q1ra', // quarter 1 rushing attempts
  'q1ry', // quarter 1 rushing yards
  'q1pa', // quarter 1 passing attempts
  'q1py', // quarter 1 passing yards
  'lcra', // late/close rushing attempt
  'lcry', // late/close rushing yards
  'lcpa', // late/close passing attempt
  'lcpy', // late/close passing yards
  'rzra', // redzone rushing attempts
  'rzry', // redzone rushing yards
  'rzpa', // redzone passing attempts
  'rzpy', // redzone passing yards
  'drv', // drives on offense
  's3a', // 3rd/short attempts
  's3c', // 3rd/short completions
  'l3a', // 3rd/long attempts
  'l3c', // 3rd/long completions
  'stf', // stuffed runs
  'fsp', // false starts
  'ohp', // offensive holding penalty
  'pbep', // play book execution penalty
  'snpo', // snaps on offense
  'pap', // play action pass attempts
  'papy', // play action pass yards
  'npr', // no pressure pass attempts
  'npry', // no pressure pass yards
  'qbp', // qb pressure
  'qbpy', // qb pressure yards
  'qbhi', // qb hit
  'qbhiy', // qb hit yards
  'qbhu', // qb hurry
  'qbhuy', // qb hurry yards
  'scrm', // scrambles
  'scrmy', // scramble yards
  'drp' // drops
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
