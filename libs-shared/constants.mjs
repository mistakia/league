// import MockDate from 'mockdate'
// import dayjs from 'dayjs'

import season_dates from './season-dates.mjs'
import Season from './season.mjs'

// MockDate.set(dayjs.unix(1631127600).toDate())

export const season = new Season(season_dates)
export const week = season.week
export const year = season.year
export const fantasy_season_week = season.fantasy_season_week
export const isOffseason = season.isOffseason
export const isRegularSeason = season.isRegularSeason
export const league_default_restricted_free_agency_announcement_hour = 24
export const league_default_restricted_free_agency_processing_hour = 0

export const nfl_draft_rounds = [0, 1, 2, 3, 4, 5, 6, 7]

export const DEFAULTS = {
  LEAGUE_ID: 0
}

export const colors = [
  '#e6194B', // red
  '#f58231', // orange
  '#ffe119', // yellow
  '#fabed4', // pink
  '#3cb44b', // green
  '#42d4f4', // cyan
  '#4363d8', // blue
  '#000075', // navy
  '#f032e6', // magenta
  '#911eb4', // purple
  '#dcbeff', // lavender
  '#aaffc3', // mint
  '#800000', // maroon
  '#9A6324', // brown
  '#fffac8', // beige
  '#a9a9a9', // grey
  '#bfef45' // lime
]

export const player_nfl_status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXEMPT: 'EXEMPT',
  RESERVE_FUTURE: 'RESERVE_FUTURE',
  CUT: 'CUT',
  PRACTICE_SQUAD: 'PRACTICE_SQUAD',
  PRACTICE_SQUAD_INJURED_RESERVE: 'PRACTICE_SQUAD_INJURED_RESERVE',
  NOT_WITH_TEAM: 'NOT_WITH_TEAM',
  PHYSICALLY_UNABLE_TO_PERFORM: 'PHYSICALLY_UNABLE_TO_PERFORM',
  INJURED_RESERVE: 'INJURED_RESERVE',
  INJURED_RESERVE_DESIGNATED_TO_RETURN: 'INJURED_RESERVE_DESIGNATED_TO_RETURN',
  INJURED_RESERVE_COVID: 'INJURED_RESERVE_COVID',
  NON_FOOTBALL_RELATED_INJURED_RESERVE: 'NON_FOOTBALL_RELATED_INJURED_RESERVE',
  RETIRED: 'RETIRED',
  RESTRICTED_FREE_AGENT: 'RESTRICTED_FREE_AGENT',
  SUSPENDED: 'SUSPENDED',
  UNDRAFTED_FREE_AGENT: 'UNDRAFTED_FREE_AGENT',
  UNSIGNED_FREE_AGENT: 'UNSIGNED_FREE_AGENT',
  DID_NOT_REPORT: 'DID_NOT_REPORT',
  COMMISSIONER_EXEMPT_LIST: 'COMMISSIONER_EXEMPT_LIST',
  WAIVED: 'WAIVED',
  EXCLUSIVE_RIGHTS_FREE_AGENT: 'EXCLUSIVE_RIGHTS_FREE_AGENT'
}

export const player_nfl_injury_status = {
  DOUBTFUL: 'DOUBTFUL',
  QUESTIONABLE: 'QUESTIONABLE',
  OUT: 'OUT',
  PROBABLE: 'PROBABLE'
}

export const nfl_player_status_abbreviations = {
  [player_nfl_status.ACTIVE]: 'ACT',
  [player_nfl_status.INACTIVE]: 'INA',
  [player_nfl_status.EXEMPT]: 'EX',
  [player_nfl_status.RESERVE_FUTURE]: 'RF',
  [player_nfl_status.CUT]: 'CUT',
  [player_nfl_status.PRACTICE_SQUAD]: 'NFL-PS',
  [player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE]: 'NFL-PS',
  [player_nfl_status.NOT_WITH_TEAM]: 'INA',
  [player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM]: 'PUP',
  [player_nfl_status.INJURED_RESERVE]: 'IR',
  [player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN]: 'IR-R',
  [player_nfl_status.INJURED_RESERVE_COVID]: 'IR-COV',
  [player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE]: 'IR-NFI',
  [player_nfl_status.RETIRED]: 'RET',
  [player_nfl_status.RESTRICTED_FREE_AGENT]: 'RF',
  [player_nfl_status.SUSPENDED]: 'SUSP',
  [player_nfl_status.UNDRAFTED_FREE_AGENT]: 'UDFA',
  [player_nfl_status.UNSIGNED_FREE_AGENT]: 'UFA',
  [player_nfl_status.DID_NOT_REPORT]: 'DNR',
  [player_nfl_status.COMMISSIONER_EXEMPT_LIST]: 'EX',
  [player_nfl_status.WAIVED]: 'WAV',
  [player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT]: 'ERFA',

  [player_nfl_injury_status.DOUBTFUL]: 'D',
  [player_nfl_injury_status.QUESTIONABLE]: 'Q',
  [player_nfl_injury_status.OUT]: 'O',
  [player_nfl_injury_status.PROBABLE]: 'P'
}

export const nfl_player_status_full = {
  [player_nfl_status.ACTIVE]: 'Active',
  [player_nfl_status.INACTIVE]: 'Inactive',
  [player_nfl_status.EXEMPT]: 'Exempt',
  [player_nfl_status.RESERVE_FUTURE]: 'Reserve Future',
  [player_nfl_status.CUT]: 'Cut',
  [player_nfl_status.PRACTICE_SQUAD]: 'Practice Squad',
  [player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE]:
    'Practice Squad Injured Reserve',
  [player_nfl_status.NOT_WITH_TEAM]: 'Not With Team',
  [player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM]:
    'Physically Unable to Perform',
  [player_nfl_status.INJURED_RESERVE]: 'Injured Reserve',
  [player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN]:
    'Injured Reserve Designated to Return',
  [player_nfl_status.INJURED_RESERVE_COVID]: 'Injured Reserve (COVID-19)',
  [player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE]:
    'Non Football Injured Reserve',
  [player_nfl_status.RETIRED]: 'Retired',
  [player_nfl_status.RESTRICTED_FREE_AGENT]: 'Restricted Free Agent',
  [player_nfl_status.SUSPENDED]: 'Suspended',
  [player_nfl_status.UNDRAFTED_FREE_AGENT]: 'Undrafted Free Agent',
  [player_nfl_status.UNSIGNED_FREE_AGENT]: 'Unsigned Free Agent',
  [player_nfl_status.DID_NOT_REPORT]: 'Did Not Report',
  [player_nfl_status.COMMISSIONER_EXEMPT_LIST]: 'Commissioner Exempt List',
  [player_nfl_status.WAIVED]: 'Waived',
  [player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT]:
    'Exclusive Rights Free Agent',

  [player_nfl_injury_status.DOUBTFUL]: 'Doubtful',
  [player_nfl_injury_status.QUESTIONABLE]: 'Questionable',
  [player_nfl_injury_status.OUT]: 'Out',
  [player_nfl_injury_status.PROBABLE]: 'Probable'
}

export const nfl_player_status_descriptions = {
  [player_nfl_status.ACTIVE]: 'Active',
  [player_nfl_status.INACTIVE]: 'Inactive',
  [player_nfl_status.EXEMPT]: 'Exempt',
  [player_nfl_status.RESERVE_FUTURE]: 'Reserve Future',
  [player_nfl_status.CUT]: 'Cut',
  [player_nfl_status.PRACTICE_SQUAD]: 'Practice Squad',
  [player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE]:
    'Practice Squad Injured Reserve',
  [player_nfl_status.NOT_WITH_TEAM]: 'Not With Team',
  [player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM]:
    'Physically Unable to Perform',
  [player_nfl_status.INJURED_RESERVE]: 'Injured Reserve',
  [player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN]:
    'Injured Reserve Designated to Return',
  [player_nfl_status.INJURED_RESERVE_COVID]: 'Injured Reserve (COVID-19)',
  [player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE]:
    'Non Football Injured Reserve',
  [player_nfl_status.RETIRED]: 'Retired',
  [player_nfl_status.RESTRICTED_FREE_AGENT]: 'Restricted Free Agent',
  [player_nfl_status.SUSPENDED]: 'Suspended',
  [player_nfl_status.UNDRAFTED_FREE_AGENT]: 'Undrafted Free Agent',
  [player_nfl_status.UNSIGNED_FREE_AGENT]: 'Unsigned Free Agent',
  [player_nfl_status.DID_NOT_REPORT]: 'Did Not Report',
  [player_nfl_status.COMMISSIONER_EXEMPT_LIST]: 'Commissioner Exempt List',
  [player_nfl_status.WAIVED]: 'Waived',
  [player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT]:
    'Exclusive Rights Free Agent',

  [player_nfl_injury_status.DOUBTFUL]: 'Doubtful',
  [player_nfl_injury_status.QUESTIONABLE]: 'Questionable',
  [player_nfl_injury_status.OUT]: 'Out',
  [player_nfl_injury_status.PROBABLE]: 'Probable'
}

const getAvailableYears = () => {
  const arr = []
  for (let i = season.year; i >= 2000; i--) {
    arr.push(i)
  }
  return arr
}
export const years = getAvailableYears()

export const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
export const fantasyWeeks = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
]
export const nfl_weeks = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21
]
export const days = ['WED', 'THU', 'TN', 'FRI', 'SAT', 'SUN', 'MN', 'SN']
export const quarters = [1, 2, 3, 4, 5]
export const downs = [1, 2, 3, 4]
export const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
export const stats = [
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',

  'ra',
  'ry',
  'ry_excluding_kneels', // rushing yards excluding kneel plays
  'tdr',
  'rush_first_down', // rushing first downs
  'fuml',

  'trg',
  'rec',
  'recy',
  'rec_first_down', // receiving first downs
  'tdrec',

  'snp',

  'twoptc',

  'prtd', // punt return touchdown
  'krtd' // kickoff return touchdown
]

export const kStats = [
  'fgm', // field goal made
  'fgy', // field goal yards (min of 30)
  'fg19', // field goal <19
  'fg29', // field goal 29
  'fg39', // field goal 39
  'fg49', // field goal 49
  'fg50', // field goal 50
  'xpm' // extra point made
]

export const dstStats = [
  'dsk', // sack
  'dint', // int
  'dff', // forced fumble
  'drf', // recovered fumble
  'dtno', // three and out
  'dfds', // fourth down stop
  'dpa', // points against
  'dya', // yards against
  'dblk', // blocked kicks
  'dsf', // safety
  'dtpr', // two point return
  'dtd' // touchdown
]

export const fantasyStats = [...stats, ...kStats, ...dstStats]

// Stats supported for projections (excludes stats not yet in projection tables)
export const projected_stats = [
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

  'twoptc',

  'prtd', // punt return touchdown
  'krtd' // kickoff return touchdown
]

export const projected_fantasy_stats = [
  ...projected_stats,
  ...kStats,
  ...dstStats
]

export const createStats = () =>
  fantasyStats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

export const statHeaders = {
  pa: 'Passing Attempts',
  pc: 'Passing Completions',
  py: 'Passing Yards',
  ints: 'Interceptions',
  tdp: 'Passing TDs',
  ra: 'Rushing Attempts',
  ry: 'Rushing Yards',
  ry_no_kneels: 'Rushing Yards (No Kneels)',
  tdr: 'Rushing TDs',
  rush_first_down: 'Rushing First Downs',
  fuml: 'Fumbles',
  trg: 'Targets',
  rec: 'Receptions',
  recy: 'Receiving Yards',
  rec_first_down: 'Receiving First Downs',
  tdrec: 'Receiving TDs',
  snp: 'Snaps',
  twoptc: 'Two Point Conversions'
}

export const fullStats = [
  // fantasy

  'pts',

  /** *********** PASSING *************/

  // pass completion percentage
  'pc_pct',

  // pass yards per game
  'py_pg',

  // touchdown percentage
  'tdp_pct',

  // interception percentage
  'ints_pct',

  // successful pass attempts
  'psucc',

  /** *********** accuracy *************/

  // interception worthy pass attempts
  'int_worthy',

  // interception worthy percentage
  'int_worthy_pct',

  // dropped passing yards
  'drppy',

  // dropped passing touchdowns
  'drptdp',

  // highlight pass attempts
  'highlight_pass',

  // dropped pass attempts
  'drpp',

  /** *********** advanced *************/

  // completed air yards
  'pcay',

  // passing yards after catch
  'pyac',

  // completed air yards per completion
  'pcay_pc',

  // passing yards after catch per completion
  'pyac_pc',

  // passing yards per attempts
  '_ypa',

  // TODO
  // adjusted passing yards per attempt
  '_adjypa',

  // passing yards per completion
  '_ypc',

  // passing yards per game
  '_ypg',

  // passing yards per air yard (passing air conversion ratio)
  '_pacr',

  // adjusted passing air conversion ratio  (pass yards + 20*(pass TD) - 45(interceptions thrown))/(air yards)
  '_apacr',

  // air yards
  'pdot',

  // air yards per attempt (average depth of taget)
  'pdot_pa',

  // TODO adj. depth of target**

  /** *********** pressure *************/

  // sacks
  'sk',

  // sack yards
  'sky',

  // sack percentage
  'sk_pct',

  // quarterback pressures
  'qb_pressure',

  // quarterback pressure percentage
  'qb_pressure_pct',

  // quarterback hit
  'qb_hit',

  // quarterback hit percentage
  'qb_hit_pct',

  // quarterback hurry
  'qb_hurry',

  // quarterback hurry percentage
  'qb_hurry_pct',

  // net yards gained per attempt: (py - sky) / (pa + sk)
  '_nygpa',

  /** *********** RECEIVING *************/

  // receiving yards per reception
  'recy_prec',

  // receiving yards per game
  'recy_pg',

  // receiving yards after the catch
  'ryac',

  // receiving yards dropped
  'drprecy',

  // dropped passes
  'drops',

  // contested targets
  'contested_ball',

  // share of team total air yards
  '_stray',

  // share of team targets
  '_sttrg',

  // deep targets (20 or more air yards)
  'dptrg',

  // deep target percentage
  'dptrg_pct',

  // targeted air yards
  'rdot',

  // completed air yards
  'rcay',

  // air yards per snap
  '_ayps',

  // air yards per reception
  '_ayprec',

  // average depth of tagret / air yards per target
  '_ayptrg',

  // receiving yards per air yard
  '_recypay',

  // receiving yards per snap
  '_recypsnp',

  // receiving yards per reception
  '_recyprec',

  // receiving yards per target
  '_recyptrg',

  // (1.5 x _sttrg + 0.7 x _stray)
  '_wopr',

  // yards after catch per reception
  '_ryacprec',

  /** *********** RUSHING *************/

  // rushing yards after contact
  'ryaco',

  // rushing yards after contact per attempt
  'ryaco_pra',

  // rushing yards per game
  'ry_pg',

  // rushing yards per rush attempt
  'ry_pra',

  // positive rushes
  'posra',

  // successful rushes
  'rasucc',

  // rushing first downs
  'rfd',

  // broken tackles
  'mbt',

  // broken tackles per touch
  'mbt_pt',

  // fumbles per rushing attempt
  '_fumlpra',

  // successful rushes per rush attempt
  'rasucc_pra',

  // positive rushes per rush attempt
  'posra_pra',

  // share of team rushing attempts
  '_stra',

  // share of team rushing yards
  '_stry',

  /** *********** misc *************/

  // touches (receptions + rush attempts)
  '_tch',

  // first downs
  'first_down',

  // successful plays
  'successful_play',

  // first down percentage
  'fd_pct',

  ...fantasyStats
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
  int_worthy_pct: passingQualifier,
  pcay_pc: passingQualifier,
  pyac_pc: passingQualifier,
  _ypa: passingQualifier,
  _adjypa: passingQualifier,
  _ypc: passingQualifier,
  _pacr: passingQualifier,
  _apacr: passingQualifier,
  pdot_pa: passingQualifier,
  sk_pct: passingQualifier,
  qb_hit_pct: passingQualifier,
  qb_pressure_pct: passingQualifier,
  qb_hurry_pct: passingQualifier,
  _nygpa: passingQualifier,

  recy_prec: receivingQualifier,
  dptrg_pct: receivingQualifier,
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

export const createFullStats = () =>
  fullStats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

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
  'qb_pressure', // qb pressure
  'qb_pressure_yds', // qb pressure yards
  'qb_hit', // qb hit
  'qb_hit_yds', // qb hit yards
  'qb_hurry', // qb hurry
  'qb_hurry_yds', // qb hurry yards
  'qb_scramble', // scrambles
  'scrmy', // scramble yards
  'drops' // drops
]

export const slots = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  WRTE: 5,
  RBWR: 6,
  RBWRTE: 7,
  QBRBWRTE: 8,
  K: 9,
  DST: 10,
  BENCH: 11,
  PS: 12, // practice squad - signed
  IR: 13, // injured reserve
  COV: 14,
  PSP: 15, // practice squad - signed and protected
  PSD: 16, // practice squad - drafted
  PSDP: 17, // practice squad - drafted and protected
  IR_LONG_TERM: 18
}

export const starterSlots = [
  slots.QB,
  slots.RB,
  slots.WR,
  slots.TE,
  slots.WRTE,
  slots.RBWR,
  slots.RBWRTE,
  slots.QBRBWRTE,
  slots.K,
  slots.DST
]

export const ps_slots = [slots.PS, slots.PSP, slots.PSD, slots.PSDP]
export const ps_protected_slots = [slots.PSP, slots.PSDP]
export const ps_unprotected_slots = [slots.PS, slots.PSD]
export const ps_signed_slots = [slots.PS, slots.PSP]
export const ps_drafted_slots = [slots.PSD, slots.PSDP]

export const slotName = {
  [slots.QB]: 'QB',
  [slots.RB]: 'RB',
  [slots.WR]: 'WR',
  [slots.TE]: 'TE',
  [slots.WRTE]: 'WR/TE',
  [slots.RBWR]: 'RB/WR',
  [slots.RBWRTE]: 'FLEX',
  [slots.QBRBWRTE]: 'SFLEX',
  [slots.K]: 'K',
  [slots.DST]: 'DST',
  [slots.BENCH]: 'BE',
  [slots.PS]: 'PS',
  [slots.IR]: 'IR',
  [slots.COV]: 'COV',
  [slots.PSP]: 'PS (P)',
  [slots.PSD]: 'PSD',
  [slots.PSDP]: 'PSD (P)',
  [slots.IR_LONG_TERM]: 'IR (LT)'
}

export const matchups = {
  H2H: 1,
  TOURNAMENT: 2
}

export const fantasyTeamStats = [
  'wins',
  'losses',
  'ties',

  'apWins',
  'apLosses',
  'apTies',

  'pf',
  'pa',
  'pdiff',

  'pp',
  'ppp',
  'pw',
  'pl',
  'pp_pct',

  'pmax',
  'pmin',
  'pdev',

  'division_finish',
  'regular_season_finish',
  'post_season_finish',
  'overall_finish',

  'weekly_high_scores',

  'doi',

  ...Object.values(slots).map((s) => `pSlot${s}`),
  ...positions.map((p) => `pPos${p}`)
]

export const createFantasyTeamStats = () =>
  fantasyTeamStats.reduce((o, key) => {
    if (
      [
        'division_finish',
        'regular_season_finish',
        'post_season_finish',
        'overall_finish'
      ].includes(key)
    ) {
      return { ...o, [key]: null }
    }
    return { ...o, [key]: 0 }
  }, {})

export const waivers = {
  FREE_AGENCY: 1,
  POACH: 2,
  FREE_AGENCY_PRACTICE: 3
}

export const waiversDetail = {
  1: 'Active Roster',
  2: 'Poach',
  3: 'Practice Squad'
}

export const transactions = {
  ROSTER_ADD: 14,
  ROSTER_RELEASE: 1,

  ROSTER_ACTIVATE: 2,
  ROSTER_DEACTIVATE: 3,

  TRADE: 4,

  POACHED: 5,

  AUCTION_BID: 6,
  AUCTION_PROCESSED: 7,

  DRAFT: 8,

  EXTENSION: 9,
  RESTRICTED_FREE_AGENCY_TAG: 10,
  FRANCHISE_TAG: 11,
  ROOKIE_TAG: 12,

  PRACTICE_ADD: 13,

  RESERVE_IR: 15,
  RESERVE_COV: 16,
  PRACTICE_PROTECTED: 17,
  RESERVE_IR_LONG_TERM: 18,

  SUPER_PRIORITY: 19
}

export const tags = {
  REGULAR: 1,
  FRANCHISE: 2,
  ROOKIE: 3,
  RESTRICTED_FREE_AGENCY: 4
}

export const tagsDetail = {
  1: 'Regular',
  2: 'Franchise',
  3: 'Rookie',
  4: 'Restricted Free Agency'
}

export const transactionsDetail = {
  14: 'Signed',
  1: 'Released',

  2: 'Activated',
  3: 'Deactivated',

  4: 'Traded',

  5: 'Poached',

  6: 'Bid',
  7: 'Signed',

  8: 'Drafted',

  9: 'Extended',
  10: 'Signed (RFA)',
  11: 'Franchised',
  12: 'Rookie Tag',
  13: 'Signed (PS)',
  15: 'Reserve (IR)',
  16: 'Reserve (COV)',
  17: 'Protected (PS)',
  18: 'Reserve (IR LT)',
  19: 'Super Priority'
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
  'JAX',
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

export const colleges = [
  'Air Force',
  'Akron',
  'Alabama',
  'Alabama State',
  'Alabama-Birmingham',
  'Albany',
  'Albany State',
  'Alberta',
  'Alcorn State',
  'Appalachian State',
  'Arizona',
  'Arizona State',
  'Arkansas',
  'Arkansas State',
  'Arkansas-Pine Bluff',
  'Army',
  'Ashland',
  'Assumption',
  'Auburn',
  'Augustana',
  'Austin Peay',
  'Azusa Pacific',
  'Ball State',
  'Baylor',
  'Bemidji State',
  'Berry College',
  'Bloomsburg',
  'Boise State',
  'Boston College',
  'Bowie State',
  'Bowling Green',
  'Brigham Young',
  'Brown',
  'Bryant',
  'Bucknell',
  'Buffalo',
  'Cal Poly',
  'California',
  'California (PA)',
  'California-Davis',
  'Canisius',
  'Carson-Newman',
  'Central Arkansas',
  'Central Connecticut State',
  'Central Florida',
  'Central Methodist',
  'Central Michigan',
  'Charleston',
  'Charlotte',
  'Chattanooga',
  'Cincinnati',
  'Citadel',
  'Clemson',
  'Coastal Carolina',
  'Colgate',
  'Colorado',
  'Colorado State',
  'Concordia',
  'Connecticut',
  'Cornell',
  'Dartmouth',
  'Dayton',
  'Delaware',
  'Delaware State',
  'Drake',
  'Dubuque',
  'Duke',
  'Duquesne',
  'East Carolina',
  'East Central Oklahoma',
  'East Tennessee State',
  'Eastern Illinois',
  'Eastern Kentucky',
  'Eastern Michigan',
  'Eastern Washington',
  'Elon',
  'Ferris State',
  'Findlay',
  'Florida',
  'Florida Atlantic',
  'Florida International',
  'Florida State',
  'Florida Tech',
  'Fordham',
  'Fort Hays State',
  'Fresno State',
  'Furman',
  'Georgetown',
  'Georgia',
  'Georgia Southern',
  'Georgia State',
  'Georgia Tech',
  'Grambling',
  'Grand Canyon',
  'Grand Valley State',
  'Greenville',
  'Hampton',
  'Harvard',
  'Hawaii',
  'Hobart',
  'Holy Cross',
  'Houston',
  'Humboldt State',
  'Idaho',
  'Idaho State',
  'Illinois',
  'Illinois State',
  'Incarnate Word',
  'Indiana',
  'Indiana State',
  'Iowa',
  'Iowa State',
  'Jacksonville State',
  'James Madison',
  'Kansas',
  'Kansas State',
  'Kennesaw State',
  'Kent State',
  'Kentucky',
  'Kentucky Wesleyan',
  'Kutztown',
  'Lake Erie',
  'Lamar',
  'Laval',
  'Lenoir-Rhyne',
  'Liberty',
  'Limestone',
  'Lindenwood',
  'Louisiana College',
  'Louisiana Tech',
  'Louisiana-Lafayette',
  'Louisiana-Monroe',
  'Louisville',
  'LSU',
  'Maine',
  'Malone',
  'Manitoba',
  'Marian',
  'Marist',
  'Mars Hill',
  'Marshall',
  'Maryland',
  'Massachusetts',
  'McGill',
  'McKendree',
  'McNeese',
  'Memphis',
  'Miami (FL)',
  'Miami (OH)',
  'Michigan',
  'Michigan State',
  'Middle Tennessee',
  'Minnesota',
  'Minnesota State',
  'Mississippi',
  'Mississippi State',
  'Missouri',
  'Missouri S&T',
  'Missouri Southern',
  'Missouri State',
  'Missouri Western',
  'Monmouth',
  'Montana',
  'Montana State',
  'Montana Western',
  'Morgan Stat',
  'Morgan State',
  'Murray State',
  'Navy',
  'Nebraska',
  'Nebraska-Kearney',
  'Nevada',
  'New Hampshire',
  'New Mexico',
  'New Mexico State',
  'Newberry',
  'Nicholls',
  'None',
  'Norfolk State',
  'North Alabama',
  'North Carolina',
  'North Carolina A&T',
  'North Carolina Central',
  'North Carolina State',
  'North Central',
  'North Dakota State',
  'North Texas',
  'Northeast Mississippi',
  'Northern Arizona',
  'Northern Colorado',
  'Northern Illinois',
  'Northern Iowa',
  'Northwestern',
  'Northwestern State',
  'Notre Dame',
  'Notre Dame (OH)',
  'Ohio',
  'Ohio State',
  'Oklahoma',
  'Oklahoma State',
  'Old Dominion',
  'Oregon',
  'Oregon State',
  'Penn State',
  'Pennsylvania',
  'Pittsburg State',
  'Pittsburgh',
  'Portland State',
  'Prairie View',
  'Prairie View A&M',
  'Presbyterian',
  'Princeton',
  'Purdue',
  'Redlands',
  'Regina',
  'Rhode Island',
  'Rice',
  'Richmond',
  'Rutgers',
  'Sacramento State',
  'Saginaw Valley State',
  'Sam Houston State',
  'Samford',
  'San Diego',
  'San Diego State',
  'San Jose State',
  'Shepherd',
  'Simon Fraser',
  'Sioux Falls',
  'Slippery Rock',
  'SMU',
  'South Alabama',
  'South Carolina',
  'South Carolina State',
  'South Dakota',
  'South Dakota State',
  'South Florida',
  'Southeast Missouri State',
  'Southeastern Louisiana',
  'Southeastern Oklahoma',
  'Southern',
  'Southern Arkansas',
  'Southern Illinois',
  'Southern Mississippi',
  'Southern Oregon',
  'Southern Utah',
  "St. John's",
  'Stanford',
  'Stephen F Austin State',
  'Stetson',
  'Stony Brook',
  'Syracuse',
  'Tarleton State',
  'Temple',
  'Tennessee',
  'Tennessee State',
  'Tennessee-Martin',
  'Texas',
  'Texas A&M',
  'Texas A&M Commerce',
  'Texas Christian',
  'Texas Southern',
  'Texas State',
  'Texas Tech',
  'Texas-El Paso',
  'Texas-San Antonio',
  'Toledo',
  'Towson',
  'Troy',
  'Tulane',
  'Tulsa',
  'UCLA',
  'UNC-Pembroke',
  'University of Montreal',
  'UNLV',
  'USC',
  'Utah',
  'Utah State',
  'Valdosta State',
  'Vanderbilt',
  'Villanova',
  'Virginia',
  'Virginia Commonwealth',
  'Virginia State',
  'Virginia Tech',
  'Virginia Union',
  'Wagner',
  'Wake Forest',
  'Washburn',
  'Washington',
  'Washington State',
  'Wayne State',
  'Weber State',
  'Wesley',
  'West Alabama',
  'West Georgia',
  'West Texas A&M',
  'West Virginia',
  'Western Carolina',
  'Western Illinois',
  'Western Kentucky',
  'Western Michigan',
  'Western Ontario',
  'Western Oregon',
  'Western State (CO)',
  'William & Mary',
  'Wisconsin',
  'Wisconsin-Beloit',
  'Wisconsin-Milwaukee',
  'Wisconsin-Platteville',
  'Wisconsin-Whitewater',
  'Wofford',
  'Wyoming',
  'Yale',
  'Youngstown',
  'Youngstown State'
]

export const collegeDivisions = [
  'American Athletic',
  'Atlantic Coast (ACC)',
  'Big 12',
  'Big East',
  'Big Sky',
  'Big Ten',
  'Colonial Athletic (CAA)',
  'Conference USA (C-USA)',
  'FBS Independents',
  'FCS Independents',
  'Ivy League',
  'Mid-American (MAC)',
  'Mid-Eastern Athletic (MEAC)',
  'Missouri Valley',
  'Mountain West (MWC)',
  'Ohio Valley',
  'Pacific 10',
  'Pacific 12',
  'Southeastern (SEC)',
  'Southern',
  'Southland',
  'Southwestern Athletic (SWAC)',
  'Sun Belt',
  'Western Athletic'
]

export const availability = [
  'ACTIVE ROSTER',
  'FREE AGENT',
  'PRACTICE SQUAD',
  'PRACTICE SQUAD PROTECTED',
  'PRACTICE SQUAD UNPROTECTED',
  'INJURED RESERVE',
  'RESTRICTED FREE AGENT',
  'POTENTIAL FREE AGENT'
]

export const errors = {
  INVALID_PARAMS: 1,

  OVER_CAP_SPACE: 2,
  OVER_ROSTER_SPACE: 3,

  INELIGIBLE_PLAYER_NOT_ON_ROSTER: 3,
  INELIGIBLE_PLAYER_NOT_ON_PRACTICE_SQUAD: 4,
  INELIGIBLE_PLAYER_EXISTING_POACHING_CLAIM: 5,
  INELIGIBLE_RELEASE_PLAYER: 6
}

export const sources = {
  FANTASY_SHARKS: 1,
  CBS: 2,
  ESPN: 3,
  NFL: 4,
  FFTODAY: 5,
  PFF: 6,
  FBG_DAVID_DODDS: 7,
  FBG_BOB_HENRY: 8,
  FBG_JASON_WOOD: 9,
  FBG_MAURILE_TREMBLAY: 10,
  FBG_SIGMUND_BLOOM: 11,
  FANTASY_FOOTBALL_NERD: 12,
  NUMBERFIRE: 13,
  DRAFT_KINGS_VA: 14,
  BETONLINE: 15,
  '4FOR4': 16,
  FANTASYPROS: 17,

  AVERAGE: 18,

  FBG_CONSENSUS: 19,
  CAESARS_VA: 20,
  FANDUEL_NJ: 21,
  BETMGM_US: 22,
  PRIZEPICKS: 23,
  GAMBET_DC: 24,
  BETRIVERS_MD: 25,
  FANTASYLIFE_DWAIN_MCFARLAND: 26,
  FANTASYLIFE: 27,
  SLEEPER: 28
}

export const source_keys = {}
for (const key in sources) {
  const value = sources[key]
  source_keys[value] = key
}

export const sourcesTitle = {
  1: 'Fantasy Sharks',
  2: 'CBS',
  3: 'ESPN',
  4: 'NFL',
  5: 'FFToday',
  6: 'PFF',
  7: 'David Dodds (FBG)',
  8: 'Bob Henry (FBG)',
  9: 'Jason Wood (FBG)',
  10: 'Maurile Tremblay (FBG)',
  11: 'Sigmund Bloom (FBG)',
  12: 'Fantasy Football Nerd',
  13: 'Numberfire',
  14: 'Draft Kings (VA)',
  15: 'BetOnline',
  16: '4For4',
  17: 'FantasyPros',

  18: 'Average',
  19: 'Footballguys',
  20: 'Caesars (VA)',
  21: 'Fanduel (NJ)',
  22: 'BetMGM (US)',
  23: 'PrizePicks',
  24: 'Gambet (DC)',
  25: 'BetRivers (MD)',
  26: 'Fantasy Life (Dwain McFarland)',
  27: 'Fantasy Life',
  28: 'Sleeper'
}

export const seas_types = ['PRE', 'REG', 'POST']

export const KEEPTRADECUT = {
  VALUE: 1,
  POSITION_RANK: 2,
  OVERALL_RANK: 3
}

export const default_points_added = -999

export const team_pid_regex = /^([A-Z]{1,3})$/gi
export const player_pid_regex =
  /^([A-Z]{4}-[A-Z]{4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2})$/gi
