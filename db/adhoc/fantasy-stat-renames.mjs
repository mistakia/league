// Fantasy-stat vocabulary rename map for the four-layer schema redesign
// (user:task/league/redesign-league-database-schema.md), fantasy-stat-vocabulary
// cluster. Promoted out of the ephemeral scratch tracker
// (scratch/league/schema-redesign/progress/nfl-team-logs.md) into durable tooling,
// the analog of PLAYER_COLUMN_RENAMES in check-player-column-repoint.mjs.
//
// This is ONE full-word vocabulary applied end to end: the JS stat-object keys in
// libs-shared/constants/stats-constants.mjs (all_fantasy_stats / projected stats),
// the DB columns on the in-scope tables below, the league_scoring_formats config
// columns, the data-view field ids, and the frontend reads -- with NO boundary map
// or reverse adapter (operator clean-end-state ruling 2026-07-22). Names follow the
// operator's standing preference for maximal verbosity/disambiguation: unified
// passing_/rushing_/receiving_ family prefixes, kickoff_ (not kick_), and fully
// spelled position words (running_back_/wide_receiver_/tight_end_, quarterback).
//
// SCOPE IS PER-TABLE, NOT A GLOBAL SHORT-CODE SED. The same short code means
// different things on different tables and MUST NOT be renamed outside the in-scope
// set below (verified 2026-07-22 against actual columns):
//   - league_team_seasonlogs.pa / league_team_careerlogs.pa / league_user_careerlogs.pa
//     are fantasy POINTS AGAINST (numeric(6,2), beside pf = points for) -> league-app
//     cluster (pa->points_against, pf->points_for), NOT pass_attempts.
//   - teams.pc is a varchar(6) code, NOT pass_completions -> league-app cluster.
//   - nfl_plays.* / nfl_team_stats play-derived pa/py/ry (comment-swapped) -> the
//     nfl_plays / nfl_team_gamelogs cluster.
//   - nfl_team_seasonlogs KEEPS its advanced-metric columns pass_epa / rush_yards_
//     over_expected / recv_* (a distinct NGS/analytics concept family, out of this
//     cluster). The fantasy vocab (passing_yards/rushing_yards/receiving_yards) is
//     textually distinct and collision-free against them.

// The authoritative old short-code -> new full-word column name map. Applied to a
// table only where the old column actually exists (intersection), so a table that
// lacks a code is simply unaffected.
export const FANTASY_STAT_RENAMES = {
  // Passing
  pa: 'passing_attempts',
  pc: 'passing_completions',
  py: 'passing_yards',
  ints: 'passing_interceptions',
  tdp: 'passing_touchdowns',

  // Rushing
  ra: 'rushing_attempts',
  ry: 'rushing_yards',
  ry_excluding_kneels: 'rushing_yards_excluding_kneels',
  tdr: 'rushing_touchdowns',
  rush_first_down: 'rushing_first_downs',

  // Receiving
  trg: 'targets',
  rec: 'receptions',
  recy: 'receiving_yards',
  rec_first_down: 'receiving_first_downs',
  tdrec: 'receiving_touchdowns',

  // Other offense
  fuml: 'fumbles_lost',
  twoptc: 'two_point_conversions',
  prtd: 'punt_return_touchdowns',
  krtd: 'kickoff_return_touchdowns',
  fum_ret_td: 'fumble_return_touchdowns',

  // Kicking
  fgm: 'field_goals_made',
  fgy: 'field_goal_yards',
  fg19: 'field_goals_made_0_19_yards',
  fg29: 'field_goals_made_20_29_yards',
  fg39: 'field_goals_made_30_39_yards',
  fg49: 'field_goals_made_40_49_yards',
  fg50: 'field_goals_made_50_plus_yards',
  xpm: 'extra_points_made',

  // Defense / DST
  dsk: 'defensive_sacks',
  dint: 'defensive_interceptions',
  dff: 'defensive_forced_fumbles',
  drf: 'defensive_recovered_fumbles',
  dtno: 'defensive_three_and_outs',
  dfds: 'defensive_fourth_down_stops',
  dpa: 'defensive_points_against',
  dya: 'defensive_yards_against',
  dblk: 'defensive_blocked_kicks',
  dsf: 'defensive_safeties',
  dtpr: 'defensive_two_point_returns',
  dtd: 'defensive_touchdowns',

  // league_scoring_formats position-scoring config columns (exist only there)
  rbrec: 'running_back_reception',
  wrrec: 'wide_receiver_reception',
  terec: 'tight_end_reception',
  exclude_qb_kneels: 'exclude_quarterback_kneels'
}

// The logical tables whose columns carry the fantasy-scoring vocabulary. Partitioned
// families are named by their parent (RENAME COLUMN on the parent cascades to every
// _year_/_default partition in Postgres). Any table NOT in this set keeps its short
// codes under this cluster and is handled by its own cluster (see the scope note).
export const IN_SCOPE_TABLES = [
  'league_scoring_formats',
  'nfl_team_seasonlogs',
  'player_gamelogs', // + player_gamelogs_year_2000..2026 + player_gamelogs_default
  'player_seasonlogs',
  'projections',
  'projections_archive',
  'projections_index', // + projections_index_y2020..2026 + projections_index_default
  'ros_projections',
  'scoring_format_player_projection_points'
]

// Tables an audit short-code lookup mis-flags but that are explicitly OUT of this
// cluster (overloaded codes / different concept families). Kept here so tooling and
// reviewers can assert the exclusion rather than rediscover it.
export const OUT_OF_SCOPE_OVERLOADED = {
  'league_team_seasonlogs.pa': 'points_against (league-app cluster)',
  'league_team_careerlogs.pa': 'points_against (league-app cluster)',
  'league_user_careerlogs.pa': 'points_against (league-app cluster)',
  'teams.pc': 'varchar code (league-app cluster)'
}
