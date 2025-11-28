import { roster_slot_types } from './roster-constants.mjs'

export const fantasy_positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']

export const base_fantasy_stats = [
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

export const kicker_fantasy_stats = [
  'fgm', // field goal made
  'fgy', // field goal yards (min of 30)
  'fg19', // field goal <19
  'fg29', // field goal 29
  'fg39', // field goal 39
  'fg49', // field goal 49
  'fg50', // field goal 50
  'xpm' // extra point made
]

export const defense_fantasy_stats = [
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

export const all_fantasy_stats = [
  ...base_fantasy_stats,
  ...kicker_fantasy_stats,
  ...defense_fantasy_stats
]

// Stats supported for projections (excludes stats not yet in projection tables)
export const projected_base_stats = [
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

export const all_projected_fantasy_stats = [
  ...projected_base_stats,
  ...kicker_fantasy_stats,
  ...defense_fantasy_stats
]

export const create_empty_fantasy_stats = () =>
  all_fantasy_stats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

export const create_empty_projected_fantasy_stats = () =>
  all_projected_fantasy_stats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

export const fantasy_stat_display_names = {
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

export const extended_player_stats = [
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

  ...all_fantasy_stats
]

const passing_qualifier = {
  type: 'pa',
  value: 14
}

const rushing_qualifier = {
  type: 'ra',
  value: 8
}

const receiving_qualifier = {
  type: 'trg',
  value: 8
}

export const stat_qualification_thresholds = {
  pc_pct: passing_qualifier,
  tdp_pct: passing_qualifier,
  ints_pct: passing_qualifier,
  psucc: passing_qualifier,
  int_worthy_pct: passing_qualifier,
  pcay_pc: passing_qualifier,
  pyac_pc: passing_qualifier,
  _ypa: passing_qualifier,
  _adjypa: passing_qualifier,
  _ypc: passing_qualifier,
  _pacr: passing_qualifier,
  _apacr: passing_qualifier,
  pdot_pa: passing_qualifier,
  sk_pct: passing_qualifier,
  qb_hit_pct: passing_qualifier,
  qb_pressure_pct: passing_qualifier,
  qb_hurry_pct: passing_qualifier,
  _nygpa: passing_qualifier,

  recy_prec: receiving_qualifier,
  dptrg_pct: receiving_qualifier,
  _ayps: receiving_qualifier,
  _ayprec: receiving_qualifier,
  _ayptrg: receiving_qualifier,
  _recypay: receiving_qualifier,
  _recypsnp: receiving_qualifier,
  _recyprec: receiving_qualifier,
  _recyptrg: receiving_qualifier,
  _ryacprec: receiving_qualifier,

  ryaco_pra: rushing_qualifier,
  ry_pra: rushing_qualifier,
  rasucc: rushing_qualifier,
  mbt_pt: rushing_qualifier,
  _fumlpra: rushing_qualifier,
  rasucc_pra: rushing_qualifier,
  posra_pra: rushing_qualifier
}

export const create_empty_extended_stats = () =>
  extended_player_stats.reduce((o, key) => ({ ...o, [key]: 0 }), {})

export const nfl_team_stats = [
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

export const fantasy_team_stats = [
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

  ...Object.values(roster_slot_types).map((s) => `pSlot${s}`),
  ...fantasy_positions.map((p) => `pPos${p}`)
]

export const create_empty_fantasy_team_stats = () =>
  fantasy_team_stats.reduce((o, key) => {
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
