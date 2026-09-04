// @ts-check
import { stat_names_for_group } from '../scoring-columns.mjs'
import { roster_slot_types } from './roster-constants.mjs'

export const fantasy_positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']

// league_team_seasonlogs column for each position's starter points. The
// 2026-08-16 position-code conformance (db/adhoc/2026-08-16-conform-position-code-tokens.sql)
// moved these to full-word tokens, and concatenating from the short abbreviation
// (as this list did until it broke the seasonlogs INSERT: `column
// "starter_points_dst" ... does not exist` on the 2026-09-01/02 finalize runs)
// points the writer at columns that no longer exist. Same shape and reason as
// max_roster_league_columns in roster-constants.mjs.
export const starter_points_league_columns = {
  QB: 'starter_points_quarterback',
  RB: 'starter_points_running_back',
  WR: 'starter_points_wide_receiver',
  TE: 'starter_points_tight_end',
  K: 'starter_points_kicker',
  DST: 'starter_points_defense_special_teams'
}

// These three lists are derived, not authored. libs-shared/scoring-columns.mjs
// is the single source; adding a scoring metric there adds it here, to
// SCORING_COLUMNS, and to the settings labels at once.
//
// They are NOT dead just because calculate-points.mjs repeats the kicking and
// DST stat names inline: all three feed `all_fantasy_stats` below, which
// `format_base_gamelog` uses to filter which fields are persisted. Dropping
// either the kicker or the defense list stops every one of those columns being
// written to player_gamelogs.
export const base_fantasy_stats = stat_names_for_group('base')

export const kicker_fantasy_stats = stat_names_for_group('kicking')

export const defense_fantasy_stats = stat_names_for_group('dst')

export const all_fantasy_stats = [
  ...base_fantasy_stats,
  ...kicker_fantasy_stats,
  ...defense_fantasy_stats
]

// Stats supported for projections (excludes stats not yet in projection tables)
export const projected_base_stats = [
  'passing_attempts',
  'passing_completions',
  'passing_yards',
  'passing_interceptions',
  'passing_touchdowns',

  'rushing_attempts',
  'rushing_yards',
  'rushing_touchdowns',
  'fumbles_lost',

  'targets',
  'receptions',
  'receiving_yards',
  'receiving_touchdowns',

  'two_point_conversions',

  'punt_return_touchdowns', // punt return touchdown
  'kickoff_return_touchdowns' // kickoff return touchdown
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
  passing_attempts: 'Passing Attempts',
  passing_completions: 'Passing Completions',
  passing_yards: 'Passing Yards',
  passing_interceptions: 'Interceptions',
  passing_touchdowns: 'Passing TDs',
  rushing_attempts: 'Rushing Attempts',
  rushing_yards: 'Rushing Yards',
  rushing_yards_excluding_kneels: 'Rushing Yards (No Kneels)',
  rushing_touchdowns: 'Rushing TDs',
  rushing_first_downs: 'Rushing First Downs',
  fumbles_lost: 'Fumbles',
  targets: 'Targets',
  receptions: 'Receptions',
  receiving_yards: 'Receiving Yards',
  receiving_first_downs: 'Receiving First Downs',
  receiving_touchdowns: 'Receiving TDs',
  two_point_conversions: 'Two Point Conversions',
  punt_return_touchdowns: 'Punt Return Touchdowns',
  kickoff_return_touchdowns: 'Kickoff Return Touchdowns',
  fumble_return_touchdowns: 'Fumble Return Touchdowns'
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
  type: 'passing_attempts',
  value: 14
}

const rushing_qualifier = {
  type: 'rushing_attempts',
  value: 8
}

const receiving_qualifier = {
  type: 'targets',
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
  'regular_season_wins',
  'regular_season_losses',
  'regular_season_ties',

  'all_play_wins',
  'all_play_losses',
  'all_play_ties',

  'points_for',
  'points_against',
  'point_differential',

  'potential_points',
  'potential_points_penalty',
  'potential_wins',
  'potential_losses',
  'potential_points_percentage',

  'highest_weekly_score',
  'lowest_weekly_score',
  'weekly_score_deviation',

  'division_finish',
  'regular_season_finish',
  'post_season_finish',
  'overall_finish',

  'weekly_high_scores',

  'draft_order_index',

  ...Object.values(roster_slot_types).map((s) => `starter_slot_${s}_points`),
  ...Object.values(starter_points_league_columns)
]

// Finish placements have no meaningful zero -- an unplayed season is "no
// placement", not "placed 0th" -- so they seed null while every other team stat
// seeds 0.
const fantasy_team_finish_stats = [
  'division_finish',
  'regular_season_finish',
  'post_season_finish',
  'overall_finish'
]

export const create_empty_fantasy_team_stats = () => {
  /** @type {Record<string, number | null>} */
  const stats = {}
  for (const key of fantasy_team_stats) {
    stats[key] = fantasy_team_finish_stats.includes(key) ? null : 0
  }
  return stats
}
