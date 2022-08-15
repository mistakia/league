// import MockDate from 'mockdate'
// import dayjs from 'dayjs'

import * as espn from './espn-constants.mjs'
import season_dates from './season-dates.mjs'
import Season from './season.mjs'
export { espn }

// MockDate.set(dayjs.unix(1631127600).toDate())

export const season = new Season(season_dates)
export const week = season.week
export const year = season.year
export const isOffseason = season.isOffseason
export const isRegularSeason = season.isRegularSeason

export const DEFAULTS = {
  LEAGUE_ID: 0
}

export const status = {
  'Voluntary Opt Out': 'OPT',
  DNR: 'DNR',
  'Did Not Report': 'DNR',

  SUSP: 'SUSP',
  Suspended: 'SUSP',

  'Practice Squad': 'NFL-PS',

  PUP: 'PUP',
  'Physically Unable to Perform': 'PUP',

  Inactive: 'INA',
  Questionable: 'Q',
  Out: 'O',
  Doubtful: 'D',

  'Injured Reserve': 'IR',
  IR: 'IR',
  'IR-R': 'IR', // IR - Return

  NFI: 'NFI',
  'NFI-A': 'NFI', // Non-Football Injury (Active)
  'NFI-R': 'NFI', // Non-Football Injury (Reserve)
  'Non Football Injury': 'NFI',
  'Non-Football Illness': 'NFI',

  CEL: 'CEL',
  'Commissioner Exempt List': 'CEL',
  'Reserve-CEL': 'CEL', // Reserve: Commissioner Exempt List

  'Reserve/COVID-19': 'COV',
  'Reserve-Covid-19': 'COV',
  'COVID-19': 'COV',

  EX: 'EX',
  'Reserve-Ex': 'EX' // Reserve: Exemption
}

export const statusDescriptions = {
  PUP: 'Physically Unable to Perform',
  OPT: 'Voluntary Opt Out',
  IR: 'Injured Reserve',
  SUSP: 'Suspended',
  CEL: 'Commissioner Exempt List',
  NFI: 'Non Football Injury',
  DNR: 'Did Not Report',
  COV: 'Reserve/COVID-19',
  'NFL-PS': 'Practice Squad',
  EX: 'Exemption',
  Q: 'Questionable',
  INA: 'Inactive',
  O: 'Out',
  D: 'Doubtful'
}

export const scoring = {
  STD: 1,
  HALF: 2,
  PPR: 3
}

const getAvailableYears = () => {
  const arr = []
  for (let i = season.year; i >= 2000; i--) {
    arr.push(i)
  }
  return arr
}
export const years = getAvailableYears()

export const byeWeeks = [6, 7, 8, 9, 10, 11, 12, 13, 14]
export const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
export const fantasyWeeks = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
]
export const nflWeeks = [
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
  tdr: 'Rushing TDs',
  fuml: 'Fumbles',
  trg: 'Targets',
  rec: 'Receptions',
  recy: 'Receiving Yards',
  tdrec: 'Receiving TDs',
  snp: 'Snaps',
  twoptc: 'Two Point Conversions'
}

export const fullStats = [
  // fantasy
  'pts',

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
  'pcay', // completed air yards
  'pyac', // yards after catch
  'pcay_pc', // completed air yards per completion
  'pyac_pc',
  '_ypa',
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
  '_stray', // share of team total air yards
  '_sttrg', // share of team targets

  // usage
  'dptrg', // deep target
  'dptrg_pct', // deep pass percentage
  'rdot', // depth of target

  // advanced
  'rcay', // completed air yards
  '_ayps', // air yards per snap
  '_ayprec', // air yards per reception
  '_ayptrg', // average depth of tagret / air yards per target
  '_recypay', // receiving yards per air yard
  '_recypsnp', // receiving yards per snap
  '_recyprec', // receiving yards per reception
  '_recyptrg', // receiving yards per target
  '_wopr', // (1.5 x _sttrg + 0.7 x _stray)
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
  '_fumlpra', // fumble rate
  'rasucc_pra', // successful rush rate
  'posra_pra', // possitive rush rate

  // usage
  '_stra', // share of team rushing attempts
  '_stry', // share of team rushing yards

  // general
  '_tch',
  'fd', // first down
  'succ',
  'fd_pct', // first down pct*
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
  intw_pct: passingQualifier,
  pcay_pc: passingQualifier,
  pyac_pc: passingQualifier,
  _ypa: passingQualifier,
  _adjypa: passingQualifier,
  _ypc: passingQualifier,
  _pacr: passingQualifier,
  _apacr: passingQualifier,
  pdot_pa: passingQualifier,
  sk_pct: passingQualifier,
  qbhi_pct: passingQualifier,
  qbp_pct: passingQualifier,
  qbhu_pct: passingQualifier,
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
  IR: 13,
  COV: 14,
  PSP: 15, // practice squad - signed and protected
  PSD: 16, // practice squad - drafted
  PSDP: 17 // practice squad - drafted and protected
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
  [slots.PSDP]: 'PSD (P)'
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

  'doi',

  ...Object.values(slots).map((s) => `pSlot${s}`),
  ...positions.map((p) => `pPos${p}`)
]

export const createFantasyTeamStats = () =>
  fantasyTeamStats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

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
  TRANSITION_TAG: 10,
  FRANCHISE_TAG: 11,
  ROOKIE_TAG: 12,

  PRACTICE_ADD: 13,

  RESERVE_IR: 15,
  RESERVE_COV: 16,
  PRACTICE_PROTECTED: 17
}

export const tags = {
  REGULAR: 1,
  FRANCHISE: 2,
  ROOKIE: 3,
  TRANSITION: 4
}

export const tagsDetail = {
  1: 'Regular',
  2: 'Franchise',
  3: 'Rookie',
  4: 'Transition'
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
  17: 'Protected (PS)'
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

export const jobs = {
  CLAIMS_WAIVERS_ACTIVE: 1,
  CLAIMS_WAIVERS_PRACTICE: 2,
  CLAIMS_WAIVERS_POACH: 3,

  CLAIMS_POACH: 4,

  PLAYERS_MFL: 5,
  IMPORT_PLAYERS_SLEEPER: 6,
  PLAYERS_MFL_INJURIES: 7,

  PROJECTIONS_PFF: 8,
  PROJECTIONS_FFTODAY: 9,
  PROJECTIONS_CBS: 10,
  PROJECTIONS_ESPN: 11,
  PROJECTIONS_FANTASYSHARKS: 12,
  PROJECTIONS_NFL: 13,

  NOTIFICATIONS_DRAFT: 14,
  NOTIFICATIONS_POACH_8HR: 15,
  NOTIFICATIONS_POACH_1HR: 16,

  GENERATE_ROSTERS: 17,
  GENERATE_DRAFT_PICKS: 18,

  PLAYERS_ARMCHAIR: 19,

  IMPORT_NFL_GAMES_NGS: 20,
  IMPORT_NFL_GAMES_NFL: 23,

  NFL_PLAYS_NGS: 21,
  NFL_PLAYS_NFL: 22,

  NFL_PLAYERS: 24,
  NFL_PLAYER_IDS: 25,

  PROJECTIONS_FBG: 26,
  PROJECTIONS_FFN: 27,
  PRACTICE_REPORT: 28,

  PROJECTIONS_NUMBERFIRE: 29,

  PROCESS_PLAY_STATS: 30,
  DATA_ARMCHAIR: 31,
  DATA_FOOTBALL_OUTSIDERS: 32,

  DRAFTKINGS_ODDS: 33,
  BETONLINE_ODDS: 34,
  PROJECTIONS_4FOR4: 35,
  FANTASYPROS_DYNASTY: 36,
  FANTASYPROS_WEEKLY: 37,
  FANTASYPROS_DRAFT: 38,

  CALCULATE_FRANCHISE_TAGS: 39,

  PROCESS_MATCHUPS: 40,
  DRAW_DIVISIONS: 41,
  GENERATE_SCHEDULE: 42,
  PROCESS_EXTENSIONS: 43,

  PROCESS_TRANSITION_BIDS: 44,
  RESET_PLAYER_TAGS: 45,
  RESET_PROTECTED_DESIGNATION: 46,
  SET_DRAFT_PICK_NUMBER: 47,

  PROCESS_PROJECTIONS: 48,
  PLAYERS_KEEPTRADECUT: 49,
  UPDATE_FORMATTED_NAMES: 50,
  IMPORT_KEEPTRADECUT: 51,

  IMPORT_PLAYS_NFLFASTR: 52,
  PROCESS_PLAYOFFS: 53
}

export const jobDetails = {
  1: 'Active Roster Free Agency Waivers',
  2: 'Practice Squad Free Agency Waivers',
  3: 'Poaching Waivers',
  4: 'Poaching Claims',
  5: 'Player Status (MFL)',
  6: 'Import Players (Sleeper)',
  7: 'Player Status (MFL Injuries)',
  8: 'Projections (PFF)',
  9: 'Projections (FFToday)',
  10: 'Projections (CBS)',
  11: 'Projections (ESPN)',
  12: 'Projections (FantasySharks)',
  13: 'Projections (NFL)',
  14: 'Notifications (Draft)',
  15: 'Notifications (Poach) 8HR',
  16: 'Notifications (Poach) 1HR',
  17: 'Generate Rosters',
  18: 'Generate Draft Picks',
  19: 'Import Players (Armchair)',
  20: 'Import NFL Games (NGS)',
  21: 'Import NFL Plays (NGS)',
  22: 'Import NFL Plays (NFL)',
  23: 'Import NFL Games (NFL)',
  24: 'NFL Players (NFL)',
  25: 'NFL Player Ids (NFL)',
  26: 'Projections (FBG)',
  27: 'Projections (FFN)',
  28: 'Practice Report',
  29: 'Projections (Numberfire)',
  30: 'Process Play Stats',
  31: 'Armchair (Data)',
  32: 'Import Football Outsiders (Data)',

  39: 'Calculate Franchise Tags',

  40: 'Process Matchups',
  41: 'Draw Divisions',
  42: 'Generate Schedule',
  43: 'Process Extensions',
  44: 'Process Transition Bids',
  45: 'Reset Player Tags',
  46: 'Reset Player Protected Designation',
  47: 'Set Draft Pick Order',
  48: 'Process Projections',
  49: 'Import Keeptradecut Players',
  50: 'Update Formatted Names',
  51: 'Import Keeptradecut',
  52: 'Import Plays nflfastR',
  53: 'Process Playoffs'
}

export const changes = {
  PLAYER_EDIT: 1,
  PLAYER_NEW: 2
}

export const oddTypes = {
  SEASON_PASSING: 1,
  SEASON_RUSHING: 2,
  SEASON_RECEIVING: 3,

  GAME_PASSING: 4,
  GAME_RECEIVING: 5,
  GAME_RUSHING: 6,
  GAME_COMPLETIONS: 7,
  GAME_PASSING_TOUCHDOWNS: 8,
  GAME_RECEPTIONS: 9,
  GAME_INTERCEPTIONS: 10,
  GAME_CARRIES: 11,
  GAME_TOUCHDOWNDS: 12
}

export const oddTypeDesc = {
  1: 'Pass (seas)',
  2: 'Rush (seas)',
  3: 'Recv (seas)',

  4: 'Pass',
  5: 'Recv',
  6: 'Rush',
  7: 'Comp',
  8: 'Pass TDs',
  9: 'Rec',
  10: 'Int',
  11: 'Carry',
  12: 'TDs'
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
  DRAFT_KINGS: 14,
  BETONLINE: 15,
  '4FOR4': 16,
  FANTASYPROS: 17,

  AVERAGE: 18,

  FBG_CONSENSUS: 19
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
  14: 'Draft Kings',
  15: 'BetOnline',
  16: '4For4',
  17: 'FantasyPros',

  18: 'Average',
  19: 'Footballguys'
}

export const rankings = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DST: 6,
  FLX: 7,
  OP: 8
}

export const seas_types = ['PRE', 'REG', 'POST']

export const KEEPTRADECUT = {
  VALUE: 1,
  POSITION_RANK: 2,
  OVERALL_RANK: 3
}
