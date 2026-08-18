import { translate_rate_type_to_output } from './data-views-output-tokens.mjs'

const TEAM_FROM_PLAYS_RE = /^team_(.+)_from_plays$/

// Play-filter param keys renamed in 8a4b6e4a (2025-07-24, "standardize variable
// naming"). That was a code-side rename with no saved-view migration, so every
// view still persisting an old key silently lost its filter:
// apply_play_by_play_column_params_to_query iterates the registry and skips
// anything it does not recognise, which produces a wrong answer rather than an
// error. As of 2026-07-28 production still carried 131 such occurrences across
// 13 saved views, found by db/gates/check-saved-view-param-coverage.mjs.
//
// The value vocabularies are unchanged across each rename, so rewriting the key
// alone is lossless. Note qb_pressure_ngs maps to qb_pressure_tracking, NOT to
// qb_pressure -- both exist in the registry today and they are different params.
//
// box_defenders is deliberately absent. The same commit renamed box_ngs ->
// box_defenders while also renaming the pre-existing box_defenders ->
// box_defenders_charted, so a persisted box_defenders key is AMBIGUOUS: it means
// the charted param in a view last saved before the rename and the NGS param in
// one saved after. A read-time migration cannot see the save date, so that case
// needs a dated one-shot migration and an explicit decision rather than a rule
// here.
const PLAY_FILTER_PARAM_RENAMES = {
  air_yards_ngs: 'air_yards',
  box_ngs: 'box_defenders',
  cov_type_ngs: 'cov_type',
  man_zone_ngs: 'man_zone',
  pru_ngs: 'pru',
  qb_pressure_ngs: 'qb_pressure_tracking',
  route_ngs: 'route',
  time_to_throw_ngs: 'time_to_throw'
}

// Play-filter param keys renamed alongside their columns by the boolean-prefix
// conformance sweep (db/adhoc/2026-08-04-conform-boolean-prefix-plays.sql and
// -tail.sql). 81 of the 249 renamed boolean columns were also registry keys, and
// the registry key IS the persisted key, so every saved view carrying one would
// have silently lost its filter -- the same failure mode as the 2025-07-24
// rename above, which is why these rules ship in the same change as the DDL
// rather than after it.
//
// Applied AFTER PLAY_FILTER_PARAM_RENAMES, which matters for exactly one key:
// a view saved before 2025-07-24 persists qb_pressure_ngs, which that map
// rewrites to qb_pressure_tracking, which this map then rewrites to
// is_qb_pressure_tracking. The single migrate_params pass resolves the chain
// only in this order.
//
// nfl_games.ot is the one entry whose column does not live on nfl_plays; it is
// a GAME-group param that apply_play_by_play_column_params_to_query resolves
// against the joined nfl_games table.
export const BOOLEAN_PREFIX_PARAM_RENAMES = {
  assist_tk: 'is_assist_tackle',
  batted_pass: 'is_batted_pass',
  catchable_ball: 'is_catchable_ball',
  comp: 'is_completion',
  contested_ball: 'is_contested_ball',
  created_reception: 'is_created_reception',
  drive_inside20: 'is_drive_inside_20',
  drive_score: 'is_drive_score',
  dropped_pass: 'is_dropped_pass',
  endzone_target: 'is_endzone_target',
  ep_att: 'is_extra_point_attempt',
  ep_succ: 'is_epa_successful',
  fg_att: 'is_field_goal_attempt',
  first_down: 'is_first_down',
  first_down_pass: 'is_first_down_pass',
  first_down_penalty: 'is_first_down_penalty',
  first_down_rush: 'is_first_down_rush',
  fourth_down_converted: 'is_fourth_down_converted',
  fourth_down_failed: 'is_fourth_down_failed',
  fum: 'is_fumble',
  fumbles_lost: 'is_fumble_lost',
  goal_to_go: 'is_goal_to_go',
  highlight_pass: 'is_highlight_pass',
  hindered_pass: 'is_hindered_pass',
  incomp: 'is_incompletion',
  int_worthy: 'is_interception_worthy',
  interceptions: 'is_interception',
  kickoff_att: 'is_kickoff_attempt',
  motion: 'is_motion',
  motion_before_snap: 'is_motion_before_snap',
  motion_during_snap: 'is_motion_during_snap',
  no_huddle: 'is_no_huddle',
  oob: 'is_out_of_bounds',
  ot: 'is_overtime',
  out_of_pocket_pass: 'is_out_of_pocket_pass',
  pain_free_play: 'is_pain_free_play',
  pass: 'is_passing_play',
  pass_breakup: 'is_pass_breakup',
  pass_td: 'is_passing_touchdown',
  penalty: 'is_penalty',
  phyb: 'is_physical_ball',
  play_action: 'is_play_action',
  punt_att: 'is_punt_attempt',
  punt_blocked: 'is_punt_blocked',
  qb_dropback: 'is_qb_dropback',
  qb_fault_sack: 'is_qb_fault_sack',
  qb_hit: 'is_qb_hit',
  qb_hurry: 'is_qb_hurry',
  qb_kneel: 'is_qb_kneel',
  qb_pressure: 'is_qb_pressure',
  qb_pressure_tracking: 'is_qb_pressure_tracking',
  qb_rush: 'is_qb_rush',
  qb_scramble: 'is_qb_scramble',
  qb_sneak: 'is_qb_sneak',
  qb_spike: 'is_qb_spike',
  ret_td: 'is_return_touchdown',
  run_play_option: 'is_run_play_option',
  rush: 'is_rushing_play',
  rush_td: 'is_rushing_touchdown',
  safety: 'is_safety',
  score: 'is_scoring_play',
  screen_pass: 'is_screen_pass',
  series_suc: 'is_series_successful',
  shovel_pass: 'is_shovel_pass',
  sideline_pass: 'is_sideline_pass',
  sk: 'is_sack',
  solo_tk: 'is_solo_tackle',
  special: 'is_special_teams_play',
  stunt: 'is_stunt',
  successful_play: 'is_successful_play',
  td: 'is_touchdown',
  tfl: 'is_tackle_for_loss',
  third_down_converted: 'is_third_down_converted',
  third_down_failed: 'is_third_down_failed',
  throw_away: 'is_throw_away',
  timeouts: 'is_timeout',
  touchback: 'is_touchback',
  trick_look: 'is_trick_look',
  trick_play: 'is_trick_play',
  two_att: 'is_two_point_conversion_attempt',
  zero_blitz: 'is_zero_blitz'
}

// Play-filter param keys renamed alongside their columns by the shorthand
// conformance sweep (72346e579, db/adhoc/2026-08-04-conform-shorthand-plays.sql
// and -tail.sql). 18 of the 204 renamed columns were also registry keys, and the
// registry key IS the persisted key, so every saved view carrying one silently
// lost its filter -- the same failure mode as the two maps above. Unlike those,
// these rules ship AFTER the DDL rather than with it: the sweep landed without
// them, and a production check on 2026-08-05 measured 49 orphaned occurrences
// across 45 saved views (qtr 25, dot 7, route 7, dwn 5, wp 5).
//
// All 18 are covered rather than only the 5 with production hits. A client
// running a stale bundle can save a view carrying any of them at any time, so a
// key with zero occurrences today is a latent instance of the same bug, and a
// one-shot SQL migration could not close that window at all.
//
// Applied AFTER PLAY_FILTER_PARAM_RENAMES, which matters for two keys: a view
// saved before 2025-07-24 persists route_ngs / pru_ngs, which that map rewrites
// to route / pru, which this map then rewrites to charted_route /
// ngs_pass_rushers. The single migrate_params pass resolves those chains only in
// this order.
//
// `dot` is deliberately absent. The depth-of-target param's COLUMN moved to
// depth_of_target while its key stayed `dot`, because param resolution is
// `column_name || param_key` and saved views persist the key -- so `dot` is
// still a live registry key (nfl-plays-column-params.mjs) and rewriting it would
// create the orphan rather than fix one.
export const SHORTHAND_PARAM_RENAMES = {
  avsk: 'avoided_sacks',
  boxdb: 'defensive_backs_in_box',
  cov: 'coverage_on_target',
  cp: 'completion_probability',
  cpoe: 'completion_percentage_over_expected',
  db: 'defensive_back_count',
  dwn: 'down_number',
  ep: 'expected_points',
  mbt: 'missed_or_broken_tackle',
  oopd: 'out_of_pocket_details',
  pru: 'ngs_pass_rushers',
  qtr: 'quarter',
  route: 'charted_route',
  surf: 'playing_surface',
  temp: 'temperature_fahrenheit',
  wind: 'wind_speed_mph',
  wp: 'win_probability',
  wpa: 'win_probability_added'
}

// Play-filter param keys renamed alongside their columns by the plays-local
// token conform (db/adhoc/2026-08-16-conform-plays-local-tokens.sql). 28 of the
// 91 renamed columns were also registry keys, and the registry key IS the
// persisted key, so every saved view carrying one would silently lose its filter
// -- the same failure mode the three maps above record, which is why these rules
// ship in the same change as the DDL rather than after it.
//
// No column ID moves in this batch: the from-plays data-view ids are semantic
// stat_names (team_pass_rate_over_expected_from_plays) and the plays-view ids
// are the play_* spellings, neither of which embeds a renamed physical column.
// Only the param keys below rename.
export const PLAYS_LOCAL_PARAM_RENAMES = {
  away_to_rem: 'away_timeouts_remaining',
  away_wp: 'away_win_probability',
  away_wp_post: 'away_win_probability_post',
  def_to_rem: 'defense_timeouts_remaining',
  drive_end_qtr: 'drive_end_quarter',
  drive_fds: 'drive_first_downs',
  drive_seq: 'drive_sequence',
  drive_start_qtr: 'drive_start_quarter',
  home_to_rem: 'home_timeouts_remaining',
  home_wp: 'home_win_probability',
  home_wp_post: 'home_win_probability_post',
  n_offense_backfield: 'number_offense_backfield',
  pass_oe: 'pass_over_expected',
  pos_to_rem: 'possession_timeouts_remaining',
  ret_yds: 'return_yds',
  score_diff: 'score_difference',
  score_diff_post: 'score_difference_post',
  sec_rem_gm: 'seconds_remaining_game',
  sec_rem_half: 'seconds_remaining_half',
  sec_rem_qtr: 'seconds_remaining_quarter',
  series_seq: 'series_sequence',
  two_conv_prob: 'two_conversion_prob',
  vegas_home_wp: 'vegas_home_win_probability',
  vegas_wp: 'vegas_win_probability',
  xyac_fd_prob: 'xyac_first_down_prob',
  xyac_succ_prob: 'xyac_success_prob',
  ydl_100: 'yard_line_100',
  ydl_num: 'yard_line_number'
}

// Side-of-the-ball prefixes, renamed by the 2026-08-16 conform
// (db/adhoc/2026-08-16-conform-side-prefix-tokens.sql): off -> offense,
// def -> defense, st -> special_teams across 141 columns. Five of them are
// registry KEYS in nfl-plays-column-params.mjs, so a saved view persisting the
// old key loses its filter silently -- the 45-view failure the maps above
// record, which is why these ship in the same change as the DDL.
//
// Note def_to_rem in PLAYS_LOCAL_PARAM_RENAMES was repointed from
// def_timeouts_remaining to defense_timeouts_remaining in this same change
// rather than being left to chain through the entry below. A rename map's
// TARGET must always be the name the registry carries TODAY: chaining works
// here only because the merge order happens to place that map first, and a map
// whose target is itself legacy is one reordering away from silently resolving
// to a key nothing recognises.
//
// No column ID moves: the plays-view ids are the play_* spellings and the
// from-plays ids are semantic stat_names, neither of which embeds a side
// prefix. Only these five param keys rename.
// Position codes, renamed by the 2026-08-16 conform
// (db/adhoc/2026-08-16-conform-position-code-tokens.sql). Only ONE of the 65
// columns is a registry key: `num_qb` on the ADP table
// (app/core/data-views-fields/player-adp-table-fields.js), which saved views
// persist. The rest are physical columns behind semantic column ids, and no
// column id embeds a position code, so nothing moves in COLUMN_ID_RENAMES.
export const POSITION_CODE_PARAM_RENAMES = {
  num_qb: 'number_quarterback'
}

// Counting-stat vocabulary, renamed by the 2026-08-17 conform
// (db/adhoc/2026-08-17-conform-counting-stat-tokens.sql). 29 of the 148 renamed
// columns are LIVE registry keys in libs-shared/nfl-plays-column-params.mjs, and
// the
// registry key IS the persisted key, so every saved view carrying one would
// otherwise silently lose its filter -- the failure mode recorded at the head of
// this file, which is why these rules ship in the same change as the DDL.
//
// Applied AFTER PLAY_FILTER_PARAM_RENAMES, and that ordering is load-bearing for
// one key: a view saved before 2025-07-24 persists cov_type_ngs, which that map
// rewrites to cov_type, which this map then rewrites to coverage_type_ngs. The
// single migrate_params pass resolves the chain only in this order.
//
// The rename gives cov_type its source qualifier back rather than the plain
// expansion, because nfl_plays already carries a coverage_type of enum type
// public.coverage_type from the PlayerProfiler charting mapping -- the
// mechanical target was taken. Its sibling cov_type_charted takes the plain
// expansion, so the two stay distinguishable.
//
// td_nfl_team is deliberately absent even though its column renames: its
// registry entry is commented out (`// TODO look into this`), so it is not a
// live param key and no saved view can persist it. A rule for it would suppress
// nothing and rewrite to a key that is equally not live -- the
// adjudication-that-suppresses-nothing shape this repo reports as a finding
// elsewhere.
//
// The value vocabularies are unchanged across every rename here, so rewriting
// the key alone is lossless.
export const COUNTING_STAT_PARAM_RENAMES = {
  comp_air_epa: 'completion_air_epa',
  comp_air_wpa: 'completion_air_wpa',
  comp_yac_epa: 'completion_yac_epa',
  comp_yac_wpa: 'completion_yac_wpa',
  cov_type: 'coverage_type_ngs',
  drive_yds: 'drive_yards',
  drive_yds_penalized: 'drive_yards_penalized',
  fg_prob: 'field_goal_prob',
  fg_result: 'field_goal_result',
  opp_fg_prob: 'opp_field_goal_prob',
  opp_td_prob: 'opp_touchdown_prob',
  pass_yds: 'pass_yards',
  pen_team: 'penalty_team',
  pen_yds: 'penalty_yards',
  // recv_yds is a frozen legacy key of THIS batch and only its VALUE moves. The
  // 2026-08-18 recv -> receiving conform renamed the physical column again, and
  // migrate_params resolves in a single pass, so a chain only works when the
  // second rule sits in a map merged LATER -- which the recv_yards rule does
  // (RECEIVING_PREFIX_PARAM_RENAMES). Pointing this one straight at the live
  // name is the same answer in one hop and does not depend on merge order.
  recv_yds: 'receiving_yards',
  return_yds: 'return_yards',
  rush_yds: 'rush_yards',
  td_prob: 'touchdown_prob',
  total_away_comp_air_epa: 'total_away_completion_air_epa',
  total_away_comp_air_wpa: 'total_away_completion_air_wpa',
  total_away_comp_yac_epa: 'total_away_completion_yac_epa',
  total_away_comp_yac_wpa: 'total_away_completion_yac_wpa',
  total_home_comp_air_epa: 'total_home_completion_air_epa',
  total_home_comp_air_wpa: 'total_home_completion_air_wpa',
  total_home_comp_yac_epa: 'total_home_completion_yac_epa',
  total_home_comp_yac_wpa: 'total_home_completion_yac_wpa',
  xyac_mean_yds: 'xyac_mean_yards',
  xyac_median_yds: 'xyac_median_yards',
  yds_gained: 'yards_gained'
}

// Markets-and-props vocabulary, renamed by the 2026-08-17 conform
// (db/adhoc/2026-08-17-conform-markets-prop-tokens.sql): prob -> probability,
// opp -> opponent, xpass_prob -> expected_pass_probability. Twelve live registry
// keys in libs-shared/nfl-plays-column-params.mjs rename, and the registry key
// IS the persisted key, so every saved view carrying one would otherwise lose
// its filter silently.
//
// Applied AFTER COUNTING_STAT_PARAM_RENAMES, and that ordering is load-bearing:
// a view saved before 2026-08-17 persists fg_prob / opp_fg_prob / td_prob /
// opp_td_prob, which that map rewrites to field_goal_prob / opp_field_goal_prob
// / touchdown_prob / opp_touchdown_prob, which this map then rewrites to the
// probability spellings. The single migrate_params pass resolves the chain only
// in this order.
export const MARKETS_PARAM_RENAMES = {
  extra_point_prob: 'extra_point_probability',
  field_goal_prob: 'field_goal_probability',
  no_score_prob: 'no_score_probability',
  opp_field_goal_prob: 'opponent_field_goal_probability',
  opp_safety_prob: 'opponent_safety_probability',
  opp_touchdown_prob: 'opponent_touchdown_probability',
  safety_prob: 'safety_probability',
  touchdown_prob: 'touchdown_probability',
  two_conversion_prob: 'two_conversion_probability',
  xpass_prob: 'expected_pass_probability',
  xyac_first_down_prob: 'xyac_first_down_probability',
  xyac_success_prob: 'xyac_success_probability'
}

export const SIDE_PREFIX_PARAM_RENAMES = {
  def_personnel: 'defense_personnel',
  def_score: 'defense_score',
  def_score_post: 'defense_score_post',
  def_timeouts_remaining: 'defense_timeouts_remaining',
  off_personnel: 'offense_personnel'
}

// The 2026-08-17 long-tail conform. Five of its nfl_plays renames are live play
// FILTER params, so a saved view carrying one drops that filter silently
// without a rule here -- the `qtr` and `dwn` failure the gate exists to catch.
// The other 41 columns in that batch back no param key.
//
// `pos_score` / `pos_score_post` / `pos_timeouts_remaining` chain off the side
// batch's `def_score` family: both sides of the possession/defense pair now
// spell their side in full.
export const LONG_TAIL_PARAM_RENAMES = {
  ep_result: 'extra_point_result',
  pos_score: 'possession_score',
  pos_score_post: 'possession_score_post',
  pos_timeouts_remaining: 'possession_timeouts_remaining',
  yard_line_num: 'yard_line_number'
}

// The 2026-08-18 recv -> receiving conform
// (db/adhoc/2026-08-18-conform-recv-to-receiving.sql). Exactly ONE of the 41
// renamed columns is also a registry key -- nfl_plays.recv_yards -- and the
// registry key IS the persisted key, so a saved view carrying it would silently
// lose its filter, the same failure mode as every map above.
//
// Production carried zero occurrences of it across 186 saved views and 875 short
// URLs when this shipped, so the rule is precautionary against anything saved
// between then and the deploy rather than a repair of live state.
//
// Merged LAST, which is what lets the counting-stat batch's frozen recv_yds key
// chain through this rule if it is ever repointed back to the intermediate
// spelling. It points at the live name directly today, so the chain is not
// load-bearing.
export const RECEIVING_PREFIX_PARAM_RENAMES = {
  recv_yards: 'receiving_yards'
}

// scoring_format_hash -> scoring_format_id, stranded by the format-id migration
// (44cf7fd9 code-side, db/adhoc/2026-05-28-format-id-migration.sql). Unlike the
// renames above this needs a VALUE mapping, not just a key rename: the persisted
// values are the retired content-derived hashes and the current identities are
// opaque (catalog slugs plus gen_random_uuid for the user-created tail). Until
// this landed, 27 production saved views silently fell back to the default
// scoring format -- a wrong answer rather than an error.
//
// These are the only two hashes any saved view persists (65 occurrences, checked
// against production 2026-07-28). Both were resolved by recomputing the retired
// hash function over the current league_scoring_formats rows, validated by
// reproducing all nine named-catalog hashes documented in the migration file
// byte-for-byte.
//
// That recomputation has a trap worth recording: fumble_return_touchdowns is
// uniformly 6 on every live row but was backfilled AFTER these hashes were
// frozen, and the hash function only mixes fum_ret_td into the key when it is
// non-zero. Recomputing with the live 6 fails all nine controls; forcing it to 0
// reproduces all nine. The DDL default of 0 is what the column meant when the
// hash was last valid.
const SCORING_FORMAT_HASH_TO_ID = {
  ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e:
    'draftkings',
  '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d':
    'b7855f1f-9f5e-47c4-ba3a-3e906272a60c'
}

// dvoa_type param VALUES renamed alongside their columns by the run-direction
// yards rename (db/adhoc/2026-08-08-rename-team-rush-direction-yards.sql). The
// five columns held rushing yards by direction and said DVOA; the rename made
// the name honest, and these are the persisted spellings that must follow it.
//
// This is a VALUE map, not a key map -- the third distinct shape in this file.
// The maps above rewrite param KEYS and COLUMN_ID_RENAMES rewrites column ids;
// `team_rush_left_end_dvoa` is neither. It is a value of the `dvoa_type` param
// on the `team_unit_dvoa` column (app/core/data-views-fields/team-dvoa-table-fields.js),
// so the only precedent here is SCORING_FORMAT_HASH_TO_ID, which is likewise a
// value mapping.
//
// That distinction is load-bearing rather than pedantic, because it decides
// which gate can see this rename: NEITHER of the two param-coverage gates can.
// check-saved-view-param-coverage walks Object.keys(node.params) and
// check-data-view-url-param-coverage walks parsed.searchParams.keys(), so both
// are green across a value rename whether or not a rule exists. There is no
// gate to lean on, which is why test/data-views.dvoa-type-value-migration.spec.mjs
// exists and why it was proven red before this map was added.
//
// All five are covered although production carried ZERO occurrences on either
// surface when this shipped (0 saved views, 0 share URLs, against a positive
// control of 7 URLs carrying team_unit_dvoa at all). A client on a stale bundle
// can persist any of them at any time, so a value with no occurrences today is a
// latent instance rather than a non-case -- the same reasoning that put all 18
// keys in SHORTHAND_PARAM_RENAMES rather than only the 5 with production hits.
// The 2026-08-17 abbreviation-token conform then moved 31 columns on the same two
// tables (ot -> overtime, rb -> running_back, te -> tight_end, wrN ->
// wide_receiver_N, and a `mid` SENSE SPLIT: second_and_mid / third_and_mid ->
// _medium, team_rush_mid_guard -> middle_guard, mid_zone KEPT). Every one of them
// is reachable as a dvoa_type value, so every one needs an entry here.
//
// ALL 31 rather than the 4 in the SPA dropdown, and that is not caution: the
// server validates dvoa_type by SHAPE, not by membership
// (team-dvoa-column-definitions.mjs splices it into identifier position after
// sql_identifier_param), so any of the ~175 columns on those tables can be
// persisted. test/data-view-queries/team-dova.json carries `pass_wr3_dvoa` —
// a value the dropdown never offered — which is the proof rather than the theory.
// Production held ZERO occurrences of any of the 31 on either surface when this
// shipped (against a positive control of 6 URLs and 29 saved views carrying
// dvoa_type at all), which makes them latent instances, not non-cases.
//
// `team_rush_mid_guard_dvoa` CHAINS: it is the 2026-08-08 legacy key, and its
// target moved again today. apply_dvoa_type_value_renames is a SINGLE-PASS
// lookup, so the chain is collapsed here at authoring time — pointing it at the
// intermediate `team_rush_mid_guard_yards` would strand a saved view on a name
// the registry no longer carries, which is the stale-target class that blanked
// filters before. Both hops therefore resolve to today's name in one step.
//
// NOTE this map is NOT covered by the `rename-map target liveness` test in
// test/data-views-saved-view-migration.spec.mjs: that suite filters exports on
// `_PARAM_RENAMES` and this is a `_VALUE_RENAMES` map, so it is the ninth map
// against those eight. Its liveness assertion lives in
// test/data-views.dvoa-type-value-migration.spec.mjs instead, resolving each
// legacy key THROUGH the migrator and requiring the result to be a column the
// two DVOA tables actually carry.
export const DVOA_TYPE_VALUE_RENAMES = {
  team_rush_left_end_dvoa: 'team_rush_left_end_yards',
  team_rush_left_tackle_dvoa: 'team_rush_left_tackle_yards',
  team_rush_mid_guard_dvoa: 'team_rush_middle_guard_yards',
  team_rush_right_tackle_dvoa: 'team_rush_right_tackle_yards',
  team_rush_right_end_dvoa: 'team_rush_right_end_yards',

  fourth_quarter_ot_dvoa: 'fourth_quarter_overtime_dvoa',
  fourth_quarter_ot_dvoa_rank: 'fourth_quarter_overtime_dvoa_rank',
  pass_points_allowed_per_game_rb: 'pass_points_allowed_per_game_running_back',
  pass_points_allowed_per_game_te: 'pass_points_allowed_per_game_tight_end',
  pass_points_allowed_per_game_wr1:
    'pass_points_allowed_per_game_wide_receiver_1',
  pass_points_allowed_per_game_wr2:
    'pass_points_allowed_per_game_wide_receiver_2',
  pass_points_allowed_per_game_wr3:
    'pass_points_allowed_per_game_wide_receiver_3',
  pass_rb_dvoa: 'pass_running_back_dvoa',
  pass_rb_dvoa_rank: 'pass_running_back_dvoa_rank',
  pass_te_dvoa: 'pass_tight_end_dvoa',
  pass_te_dvoa_rank: 'pass_tight_end_dvoa_rank',
  pass_wr1_dvoa: 'pass_wide_receiver_1_dvoa',
  pass_wr1_dvoa_rank: 'pass_wide_receiver_1_dvoa_rank',
  pass_wr2_dvoa: 'pass_wide_receiver_2_dvoa',
  pass_wr2_dvoa_rank: 'pass_wide_receiver_2_dvoa_rank',
  pass_wr3_dvoa: 'pass_wide_receiver_3_dvoa',
  pass_wr3_dvoa_rank: 'pass_wide_receiver_3_dvoa_rank',
  pass_yards_allowed_per_game_rb: 'pass_yards_allowed_per_game_running_back',
  pass_yards_allowed_per_game_te: 'pass_yards_allowed_per_game_tight_end',
  pass_yards_allowed_per_game_wr1:
    'pass_yards_allowed_per_game_wide_receiver_1',
  pass_yards_allowed_per_game_wr2:
    'pass_yards_allowed_per_game_wide_receiver_2',
  pass_yards_allowed_per_game_wr3:
    'pass_yards_allowed_per_game_wide_receiver_3',
  second_and_mid_dvoa: 'second_and_medium_dvoa',
  second_and_mid_dvoa_rank: 'second_and_medium_dvoa_rank',
  team_rb_yards: 'team_running_back_yards',
  team_rb_yards_rank: 'team_running_back_yards_rank',
  team_rush_mid_guard_percentage: 'team_rush_middle_guard_percentage',
  team_rush_mid_guard_yards: 'team_rush_middle_guard_yards',
  team_rush_mid_guard_yards_rank: 'team_rush_middle_guard_yards_rank',
  third_and_mid_dvoa: 'third_and_medium_dvoa',
  third_and_mid_dvoa_rank: 'third_and_medium_dvoa_rank'
}

// Rewrites a params object's dvoa_type value(s), returning the params unchanged
// when nothing matches. Exported because the SHARE-URL path needs exactly this
// and nothing else: parse_table_state_from_url runs only the nfl-week migration,
// so without this call a share URL carrying a renamed dvoa_type is rewritten by
// nothing at all, and a share URL cannot be re-saved the way a view can.
//
// Deliberately narrower than running the whole saved-view migration over URL
// state. That would ALSO newly apply every param-key and column-id rename to
// share URLs -- a real improvement, since URLs currently receive none of them,
// but a wider behaviour change than this rename needs and one nobody has
// measured against the 863 production URLs. Left as a separate question.
//
// dvoa_type is declared `single: true` in the field definition, but a persisted
// value may be a scalar or a one-element array -- the field's own
// reverse_percentiles reader branches on Array.isArray for the sibling team_unit
// param -- so both shapes are handled and the shape is preserved. An
// unrecognised value is left alone: it is one of the ~50 dvoa_type values this
// rename does not touch.
export const apply_dvoa_type_value_renames = (params) => {
  if (!params || !Object.prototype.hasOwnProperty.call(params, 'dvoa_type')) {
    return { params, changed: false }
  }

  const raw = params.dvoa_type
  const rename = (value) =>
    Object.prototype.hasOwnProperty.call(DVOA_TYPE_VALUE_RENAMES, value)
      ? DVOA_TYPE_VALUE_RENAMES[value]
      : value

  const mapped = Array.isArray(raw) ? raw.map(rename) : rename(raw)
  const changed = Array.isArray(raw)
    ? mapped.some((value, index) => value !== raw[index])
    : mapped !== raw

  return changed
    ? { params: { ...params, dvoa_type: mapped }, changed: true }
    : { params, changed: false }
}

// Column ids superseded by a differently-named column. Unlike the param maps
// above, these rewrite the column_id itself, so a sort or filter entry naming
// the old id follows through `rename_map` in migrate_entries_array.
//
// The two scoring-format-log games-played ids were removed in edc8ec9a9
// (2024-08-08) when `player_games_played` unified the per-game denominator
// across sources. They have no server column definition and no shared
// description, so they are DEAD rather than drifted -- a saved view still
// carrying one threw "Field not found for column_id" on every render (signal
// 124652) with no way to recover the column. `player_games_played` declares
// `row_axes: ['year']` and the per-game CTE honours `params.year`
// (rate-type-per-game.mjs), so a persisted year window carries over unchanged;
// the careerlogs id carries no year window to begin with.
// `player_pff_receiving_snaps` never held receiving snaps: PFF's
// `receiving_snaps` field counts the pass plays a player was on the field for,
// which is what pff.com shows under PASS, so the column became `pass_plays` and
// the id follows it. This rename is VALUE-PRESERVING and that is the whole
// point of doing it as a rename -- the alternative on the table was to leave
// the id alone and repoint it at the new `routes` column, which would have kept
// every saved view rendering while silently changing the number it displays.
// Nothing could have caught that: check-saved-view-param-coverage walks param
// KEYS, so a semantic repoint under a stable id is invisible to it. Anyone
// wanting routes adds `player_pff_routes` deliberately.
export const COLUMN_ID_RENAMES = {
  player_fantasy_games_played_from_seasonlogs: 'player_games_played',
  player_fantasy_games_played_from_careerlogs: 'player_games_played',
  player_pff_receiving_snaps: 'player_pff_pass_plays',
  // These six run BACKWARDS relative to every other entry -- the stranded id is
  // the CONFORMED spelling and the live one is the shorthand -- and that is the
  // point. The 2026-08-17 counting-stat conform moved the `base_name` variable
  // that projected-table-fields.js interpolates into BOTH the persisted column id
  // and the player_value_path, so for the window before 3e95d695c the SPA offered
  // ids the server registry never had (signals 125880/125881). That fix correctly
  // restored the shorthand in the registry, which STRANDED any view saved during
  // the window: one production view carries
  // player_season_projected_{pass,rush}_yards today and throws "Field not found
  // for column_id" before rendering a row (signals 125975/125976).
  //
  // All three period prefixes are listed rather than only the `season` pair with
  // production hits, per the reasoning in the cpoe and pct notes below: the
  // broken bundle built week / season / rest_of_season from the same base_name,
  // so the other four are latent instances rather than non-cases.
  player_week_projected_pass_yards: 'player_week_projected_pass_yds',
  player_season_projected_pass_yards: 'player_season_projected_pass_yds',
  player_rest_of_season_projected_pass_yards:
    'player_rest_of_season_projected_pass_yds',
  player_week_projected_rush_yards: 'player_week_projected_rush_yds',
  player_season_projected_rush_yards: 'player_season_projected_rush_yds',
  player_rest_of_season_projected_rush_yards:
    'player_rest_of_season_projected_rush_yds',
  // The 2026-08-04 shorthand sweep renamed the COLUMN to
  // completion_percentage_over_expected but left the id spelled `cpoe`, and
  // select_as derives the payload key from the column -- so the client's
  // player_value_path had been reading a key the server stopped emitting and the
  // column rendered blank. Measured 0 saved views and 0 share URLs on the old id
  // at the time of the fix; the entry is here for anything saved between then
  // and the deploy.
  nfl_team_seasonlogs_cpoe:
    'nfl_team_seasonlogs_completion_percentage_over_expected',
  // The 2026-08-15 pct -> percentage conform. Fifteen ids move because their
  // spelling embeds a renamed column; column ids derive from column_name, so the
  // server stops emitting the old key and the client's player_value_path renders
  // blank without these -- the same failure the cpoe entry above records.
  //
  // Listed in full rather than only the ids with production occurrences, per the
  // reasoning in the dvoa note: a client on a stale bundle can persist any of
  // them at any time, so an id with no hits today is a latent instance.
  player_contract_apy: 'player_contract_average_annual_value',
  player_contract_apy_cap_pct:
    'player_contract_average_annual_value_cap_percentage',
  player_contract_inflated_apy: 'player_contract_inflated_average_annual_value',
  player_dfs_ownership_pct: 'player_dfs_ownership_percentage',
  nfl_team_seasonlogs_pass_comp_pct: 'nfl_team_seasonlogs_pass_comp_percentage',
  nfl_team_seasonlogs_pass_yards_after_catch_pct:
    'nfl_team_seasonlogs_pass_yards_after_catch_percentage',
  nfl_team_seasonlogs_deep_pass_att_pct:
    'nfl_team_seasonlogs_deep_pass_att_percentage',
  nfl_team_seasonlogs_tight_window_pct:
    'nfl_team_seasonlogs_tight_window_percentage',
  nfl_team_seasonlogs_play_action_pct:
    'nfl_team_seasonlogs_play_action_percentage',
  nfl_team_seasonlogs_rush_attempts_inside_tackles_pct:
    'nfl_team_seasonlogs_rush_attempts_inside_tackles_percentage',
  nfl_team_seasonlogs_rush_attempts_stacked_box_pct:
    'nfl_team_seasonlogs_rush_attempts_stacked_box_percentage',
  nfl_team_seasonlogs_rush_attempts_under_center_pct:
    'nfl_team_seasonlogs_rush_attempts_under_center_percentage',
  // These two are frozen legacy keys from the pct batch, and their VALUES move
  // with the 2026-08-18 recv -> receiving conform. migrate_column_entry does a
  // SINGLE lookup with no chaining, so a value left pointing at the
  // intermediate spelling would resolve to an id the fields index no longer
  // carries -- the blank-cell shape, one step further along.
  nfl_team_seasonlogs_recv_deep_target_pct:
    'nfl_team_seasonlogs_receiving_deep_target_percentage',
  nfl_team_seasonlogs_recv_tight_window_pct:
    'nfl_team_seasonlogs_receiving_tight_window_percentage',
  // The 2026-08-18 recv -> receiving conform. Seventeen ids move because their
  // spelling derives from a renamed column, so the server stops emitting the old
  // key and the client's player_value_path renders blank without these.
  //
  // Production carried ZERO saved views and ZERO share URLs naming any of them
  // at authoring time; these are precautionary against anything saved between
  // then and the deploy, per the reasoning in the pct note above.
  //
  // nfl_team_seasonlogs_recv_avg_target_separation additionally repairs a
  // divergence the counting batch left: its player_value_path already read
  // nfl_team_seasonlogs_recv_average_target_separation, which did not match its
  // own id.
  nfl_team_seasonlogs_expected_recv_yards_after_catch:
    'nfl_team_seasonlogs_expected_receiving_yards_after_catch',
  nfl_team_seasonlogs_recv_air_yards: 'nfl_team_seasonlogs_receiving_air_yards',
  nfl_team_seasonlogs_recv_air_yards_per_target:
    'nfl_team_seasonlogs_receiving_air_yards_per_target',
  nfl_team_seasonlogs_recv_avg_target_separation:
    'nfl_team_seasonlogs_receiving_average_target_separation',
  nfl_team_seasonlogs_recv_deep_target_percentage:
    'nfl_team_seasonlogs_receiving_deep_target_percentage',
  nfl_team_seasonlogs_recv_drop_rate: 'nfl_team_seasonlogs_receiving_drop_rate',
  nfl_team_seasonlogs_recv_drops: 'nfl_team_seasonlogs_receiving_drops',
  nfl_team_seasonlogs_recv_epa: 'nfl_team_seasonlogs_receiving_epa',
  nfl_team_seasonlogs_recv_epa_per_route:
    'nfl_team_seasonlogs_receiving_epa_per_route',
  nfl_team_seasonlogs_recv_epa_per_target:
    'nfl_team_seasonlogs_receiving_epa_per_target',
  nfl_team_seasonlogs_recv_tight_window_percentage:
    'nfl_team_seasonlogs_receiving_tight_window_percentage',
  nfl_team_seasonlogs_recv_yards_15_plus_rate:
    'nfl_team_seasonlogs_receiving_yards_15_plus_rate',
  nfl_team_seasonlogs_recv_yards_after_catch:
    'nfl_team_seasonlogs_receiving_yards_after_catch',
  nfl_team_seasonlogs_recv_yards_after_catch_over_expected:
    'nfl_team_seasonlogs_receiving_yards_after_catch_over_expected',
  nfl_team_seasonlogs_recv_yards_after_catch_per_reception:
    'nfl_team_seasonlogs_receiving_yards_after_catch_per_reception',
  nfl_team_seasonlogs_recv_yards_per_reception:
    'nfl_team_seasonlogs_receiving_yards_per_reception',
  nfl_team_seasonlogs_recv_yards_per_route:
    'nfl_team_seasonlogs_receiving_yards_per_route'
}

// Column-id renames for the SHARE-URL path, which receives none of the read-time
// migration a saved view gets: a query string carries no version field, so it
// never enters the versioned chain and `parse_table_state_from_url` runs only
// the nfl-week migration plus the dvoa value renames. Without this a shared link
// naming a renamed id breaks loudly on render, and unlike a saved view it can
// never be re-saved. Measured at the time of the pff rename: 7 of 869 production
// URLs carry `player_pff_receiving_snaps`.
//
// Narrow on purpose -- column ids only, not the param-key maps. Applying those
// to URLs too is a real improvement and still unmeasured against the 863 URLs;
// it stays the separate question the dvoa note above already records.
export const apply_column_id_rename = (column_id) =>
  Object.prototype.hasOwnProperty.call(COLUMN_ID_RENAMES, column_id)
    ? COLUMN_ID_RENAMES[column_id]
    : column_id

// Merge order is load-bearing: a legacy key may chain through two maps in the
// single migrate_params pass below, and only this order resolves the chains
// (qb_pressure_ngs -> qb_pressure_tracking -> is_qb_pressure_tracking;
// route_ngs -> route -> charted_route; pru_ngs -> pru -> ngs_pass_rushers;
// cov_type_ngs -> cov_type -> coverage_type_ngs).
const PARAM_KEY_RENAMES = {
  ...PLAY_FILTER_PARAM_RENAMES,
  ...BOOLEAN_PREFIX_PARAM_RENAMES,
  ...SHORTHAND_PARAM_RENAMES,
  ...PLAYS_LOCAL_PARAM_RENAMES,
  ...SIDE_PREFIX_PARAM_RENAMES,
  ...POSITION_CODE_PARAM_RENAMES,
  ...COUNTING_STAT_PARAM_RENAMES,
  ...MARKETS_PARAM_RENAMES,
  ...LONG_TAIL_PARAM_RENAMES,
  ...RECEIVING_PREFIX_PARAM_RENAMES
}

// Every legacy param key this module rewrites at read time, exported so
// db/gates/check-saved-view-param-coverage.mjs can recognise them EXACTLY. That
// checker otherwise infers handling by grepping this file for tokens, and its
// tokenizer requires three characters or more -- so a two-character legacy key
// (wp, cp, ep, db) is structurally unmatchable and reports as an orphan even
// with a correct rule in place. Measured: `wp` did exactly that on 2026-08-05.
export const MIGRATED_PARAM_KEYS = new Set(Object.keys(PARAM_KEY_RENAMES))

const migrate_params = (params) => {
  let next = params
  let changed = false

  if (Object.prototype.hasOwnProperty.call(next, 'scoring_format_hash')) {
    const raw = next.scoring_format_hash
    const values = raw == null ? [] : [].concat(raw)
    const mapped = values.map((value) => SCORING_FORMAT_HASH_TO_ID[value])
    // An unrecognised hash is left in place deliberately: mapping it to nothing
    // would convert a detectable dead filter into an undetectable one, and
    // check-saved-view-param-coverage.mjs keeps reporting it until it is
    // resolved the same way these two were.
    if (values.length && mapped.every(Boolean)) {
      const { scoring_format_hash: _drop, ...rest } = next
      next = Object.prototype.hasOwnProperty.call(rest, 'scoring_format_id')
        ? rest
        : {
            ...rest,
            scoring_format_id: Array.isArray(raw) ? mapped : mapped[0]
          }
      changed = true
    }
  }

  for (const [legacy_key, current_key] of Object.entries(PARAM_KEY_RENAMES)) {
    if (!Object.prototype.hasOwnProperty.call(next, legacy_key)) continue
    const { [legacy_key]: value, ...rest } = next
    // A view that somehow carries both keys keeps the current one; the legacy
    // key is the stale copy by construction.
    next = Object.prototype.hasOwnProperty.call(rest, current_key)
      ? rest
      : { ...rest, [current_key]: value }
    changed = true
  }

  const dvoa_type_result = apply_dvoa_type_value_renames(next)
  if (dvoa_type_result.changed) {
    next = dvoa_type_result.params
    changed = true
  }

  if (next.rate_type != null && next.output == null) {
    const token = Array.isArray(next.rate_type) ? next.rate_type[0] : null
    const translated = token ? translate_rate_type_to_output(token) : null
    if (translated) {
      next = { ...next, output: translated }
      changed = true
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'rate_type')) {
    const { rate_type: _drop, ...rest } = next
    next = rest
    changed = true
  }

  if (
    Object.prototype.hasOwnProperty.call(next, 'rate_type_match_column_params')
  ) {
    const { rate_type_match_column_params: value, ...rest } = next
    next = { ...rest, output_match_column_params: value }
    changed = true
  }
  if (Object.prototype.hasOwnProperty.call(next, 'rate_type_column_params')) {
    const { rate_type_column_params: value, ...rest } = next
    next = { ...rest, output_column_params: value }
    changed = true
  }

  return { params: next, changed }
}

export const migrate_column_entry = ({ column_id, params }) => {
  const entry = migrate_params(params || {})
  let next_column_id = column_id
  let next_params = entry.params
  let changed = entry.changed

  if (Object.prototype.hasOwnProperty.call(COLUMN_ID_RENAMES, next_column_id)) {
    next_column_id = COLUMN_ID_RENAMES[next_column_id]
    changed = true
  }

  const team_match = TEAM_FROM_PLAYS_RE.exec(column_id)
  if (team_match && next_params.limit_to_player_active_games) {
    next_column_id = `player_team_${team_match[1]}_from_plays`
    const { limit_to_player_active_games: _drop, ...rest } = next_params
    next_params = rest
    changed = true
  }

  return { column_id: next_column_id, params: next_params, changed }
}

// Walks an entries array, collecting any column_id renames into `rename_map`
// so sort entries (which carry only column_id) can follow the rename.
const migrate_entries_array = ({ entries, rename_map }) => {
  if (!Array.isArray(entries)) return { entries, changed: false }
  let changed = false
  const next = entries.map((entry) => {
    if (typeof entry === 'string') {
      const migrated = migrate_column_entry({ column_id: entry, params: {} })
      if (migrated.column_id !== entry) {
        changed = true
        rename_map.set(entry, migrated.column_id)
        return Object.keys(migrated.params).length > 0
          ? { column_id: migrated.column_id, params: migrated.params }
          : migrated.column_id
      }
      return entry
    }
    if (!entry || typeof entry !== 'object' || !entry.column_id) return entry
    const migrated = migrate_column_entry({
      column_id: entry.column_id,
      params: entry.params || {}
    })
    if (migrated.column_id !== entry.column_id) {
      rename_map.set(entry.column_id, migrated.column_id)
    }
    if (migrated.changed) {
      changed = true
      return {
        ...entry,
        column_id: migrated.column_id,
        params: migrated.params
      }
    }
    return entry
  })
  return { entries: next, changed }
}

const apply_rename_to_sort = ({ sort, rename_map }) => {
  if (!Array.isArray(sort) || rename_map.size === 0) {
    return { sort, changed: false }
  }
  let changed = false
  const next = sort.map((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.column_id) return entry
    const renamed = rename_map.get(entry.column_id)
    if (renamed && renamed !== entry.column_id) {
      changed = true
      return { ...entry, column_id: renamed }
    }
    return entry
  })
  return { sort: next, changed }
}

export const migrate_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') {
    return { changed: false, table_state }
  }
  let changed = false
  const next = { ...table_state }
  const rename_map = new Map()

  const columns_result = migrate_entries_array({
    entries: table_state.columns,
    rename_map
  })
  if (columns_result.changed) {
    next.columns = columns_result.entries
    changed = true
  }

  const prefix_result = migrate_entries_array({
    entries: table_state.prefix_columns,
    rename_map
  })
  if (prefix_result.changed) {
    next.prefix_columns = prefix_result.entries
    changed = true
  }

  const where_result = migrate_entries_array({
    entries: table_state.where,
    rename_map
  })
  if (where_result.changed) {
    next.where = where_result.entries
    changed = true
  }

  const sort_result = apply_rename_to_sort({
    sort: table_state.sort,
    rename_map
  })
  if (sort_result.changed) {
    next.sort = sort_result.sort
    changed = true
  }

  if (Object.prototype.hasOwnProperty.call(next, 'splits')) {
    const legacy = next.splits
    delete next.splits
    if (
      !Array.isArray(next.row_axes) &&
      Array.isArray(legacy) &&
      legacy.length > 0
    ) {
      next.row_axes = legacy
    }
    changed = true
  }

  if (Object.prototype.hasOwnProperty.call(next, 'subjects')) {
    const legacy = next.subjects
    delete next.subjects
    if (
      !Array.isArray(next.row_grain) &&
      Array.isArray(legacy) &&
      legacy.length > 0
    ) {
      next.row_grain = legacy
    }
    changed = true
  }

  if (!Array.isArray(next.row_grain) || next.row_grain.length === 0) {
    next.row_grain = ['player']
    changed = true
  }

  return { changed, table_state: next }
}
