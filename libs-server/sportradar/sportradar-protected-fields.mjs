/**
 * Fields that a MORE AUTHORITATIVE source owns, and that the Sportradar
 * importer must therefore never OVERWRITE — not even when run with
 * `--overwrite_existing` or with the field present in `overwrite_fields`.
 *
 * This is the inverse of SPORTRADAR_EXCLUSIVE_FIELDS (see
 * ./sportradar-exclusive-fields.mjs): exclusive fields are ones Sportradar
 * owns and may freely re-write; protected fields are ones owned by FTN manual
 * charting or nflfastR official play-by-play, where Sportradar is at best a
 * provisional/live proxy.
 *
 * Semantics (enforced in libs-server/update-play.mjs `compute_play_changes`):
 *   - Sportradar may still FILL a protected field while it is empty (a live
 *     import populating a value before FTN/nflfastR data exists).
 *   - Sportradar may NEVER overwrite a protected field that already holds a
 *     value, `false` and `0` included — only an empty column may be filled,
 *     regardless of the overwrite flags. The authoritative
 *     post-game source (FTN/nflfastR) is the only writer permitted to correct
 *     an existing value, and those importers do not pass this set.
 *
 * Background: the 2026-05-24 incident. A historical re-import run with
 * `--overwrite_existing` flipped ~12,259 FTN-sourced `catchable_ball` TRUE
 * values to FALSE (and clobbered run_play_option, screen_pass, no_huddle,
 * quarterback_position, starting_hash, and the nflfastR-owned outcome flags below).
 * `overwrite_existing=true` bypassed the per-field allowlist entirely. This
 * blocklist is the structural backstop that the allowlist could not provide.
 */
export const SPORTRADAR_PROTECTED_FIELDS = new Set([
  // ---- FTN charting (manual expert charting; authoritative) ----
  // Source: scripts/import-plays-nflfastr-ftn.mjs format_play()
  'is_catchable_ball', // the 2026-05-24 damaged field
  'is_dropped_pass',
  'is_run_play_option',
  'is_screen_pass',
  'is_no_huddle',
  'is_motion',
  'is_play_action', // (Sportradar mapping already disabled)
  'is_trick_play',
  'is_out_of_pocket_pass',
  'is_interception_worthy',
  'is_throw_away',
  'is_contested_ball',
  'is_created_reception',
  'is_qb_sneak',
  'is_qb_fault_sack',
  'read_thrown', // read_thrown
  'quarterback_position', // qb_location — FTN pre-snap formation is authoritative
  'starting_hash', // starting_hash — FTN pre-snap formation is authoritative
  'number_offense_backfield', // number_offense_backfield
  'blitzers', // n_blitzers
  'pass_rushers', // n_pass_rushers

  // ---- nflfastR official play-by-play (authoritative play outcomes) ----
  // Source: scripts/import-plays-nflfastr.mjs format_play()
  'is_completion', // Sportradar live-fills, nflfastR is final
  'is_incompletion',
  'is_passing_touchdown',
  'is_rushing_touchdown',
  'is_touchdown',
  'is_interception',
  'is_sack',
  'is_first_down',
  'is_first_down_pass',
  'is_first_down_rush',
  'is_first_down_penalty',
  'is_qb_dropback',
  'is_qb_kneel',
  'is_qb_scramble',

  // ---- Contested columns ruled on 2026-09-05 by the field-authority audit ----
  //
  // Until that audit the importer wrote 81 nfl_plays columns that neither list
  // named. Those were fill-only by DEFAULT and fully overwritable under
  // `--overwrite_existing` -- which is precisely the gap the 2026-05-24
  // is_catchable_ball incident ran through, still open on 81 more columns.
  //
  // Each column below is written by at least one OTHER writer, established by
  // scanning WRITER_CORPUS in ./sportradar-uncontested-fields.mjs rather than by
  // reading names, and the trailing comment records which. A contested column
  // defaults to PROTECTED rather than to exclusive: Sportradar is a live proxy for
  // most of them and there is no positive evidence it is the authority for any, so
  // the safe direction is that it may FILL an empty column and never correct a
  // value another writer already put there. Normal importer runs are fill-only
  // already, so this changes nothing about them; it constrains exactly the two
  // overwrite flags that have caused damage before.
  //
  // Move a column OUT of here into the exclusive list when there is evidence
  // Sportradar is the authoritative source for it -- not because a re-import wants
  // to overwrite it. That reasoning is what put `drive_yards` in overwrite_fields.
  'away_score', // nflfastr
  'ball_carrier_gsis_player_id', // scripts/process-plays,enrich:player-identification-enrichment
  'ball_carrier_pid', // nfl-v1,scripts/process-plays,enrich:player-identification-enrichment
  'defense_nfl_team', // nfl-v1,nflfastr,charting,charted-plays-from-csv,scripts/process-plays,enrich:fixed-drive-enrichment,enrich:team-assignment-enrichment
  'drive_end_transition', // nflfastr
  'drive_first_downs', // nflfastr
  'drive_play_count', // nfl-v1,nflfastr,enrich:drive-play-count-enrichment
  'drive_sequence', // nfl-v1,nflfastr,enrich:drive-play-count-enrichment,enrich:enrichment-helpers,enrich:fixed-drive-enrichment,enrich:index
  'drive_start_transition', // nflfastr
  'drive_top', // nflfastr
  'drive_yards', // nfl-v1
  'drive_yards_penalized', // nflfastr
  'field_goal_result', // nflfastr
  'game_clock_start', // nfl-v1,nflfastr,charted-plays-from-csv
  'home_score', // nflfastr
  'interceptor_gsis_player_id', // scripts/process-plays,enrich:player-identification-enrichment
  'interceptor_pid', // scripts/process-plays,enrich:player-identification-enrichment
  'is_field_goal_attempt', // nflfastr
  'is_fumble_lost', // enrich:fixed-drive-enrichment,enrich:yardage-stat-enrichment
  'is_goal_to_go', // nfl-v1
  'is_kickoff_attempt', // nflfastr,enrich:fixed-drive-enrichment
  'is_out_of_bounds', // nflfastr
  'is_penalty', // nfl-v1
  'is_punt_attempt', // nflfastr
  'is_punt_blocked', // nflfastr
  'is_qb_spike', // nfl-v1,nflfastr,enrich:qb-play-enrichment
  'is_return_touchdown', // enrich:yardage-stat-enrichment
  'is_safety', // nflfastr,enrich:fixed-drive-enrichment
  'is_tackle_for_loss', // nflfastr
  'is_touchback', // nflfastr
  'kick_distance', // nflfastr
  'offense_nfl_team', // nfl-v1,nflfastr,charting,charted-plays-from-csv,scripts/process-plays,enrich:fixed-drive-enrichment,enrich:team-assignment-enrichment
  'pass_yards', // nflfastr,enrich:yardage-stat-enrichment
  'passer_gsis_player_id', // scripts/process-plays,enrich:player-identification-enrichment
  'passer_pid', // nfl-v1,scripts/process-plays,enrich:player-identification-enrichment
  'penalty_player_gsis', // nflfastr,scripts/process-plays,enrich:player-identification-enrichment
  'penalty_player_pid', // scripts/process-plays,enrich:player-identification-enrichment
  'penalty_team', // nflfastr
  'penalty_type', // nflfastr
  'penalty_yards', // nflfastr
  'play_type', // nfl-v1,nflfastr,scripts/process-plays,enrich:drive-play-count-enrichment,enrich:enrichment-helpers,enrich:fixed-drive-enrichment,enrich:index,enrich:play-type-enrichment
  'possession_nfl_team', // nfl-v1,nflfastr,enrich:fixed-drive-enrichment,enrich:team-assignment-enrichment
  'receiving_yards', // nflfastr,enrich:yardage-stat-enrichment
  'return_yards', // enrich:yardage-stat-enrichment
  'run_gap', // nflfastr
  'rush_yards', // nflfastr,enrich:yardage-stat-enrichment
  'seconds_remaining_game', // nfl-v1,nflfastr
  'seconds_remaining_half', // nfl-v1,nflfastr
  'seconds_remaining_quarter', // nfl-v1,nflfastr,charting
  'target_gsis_player_id', // scripts/process-plays,enrich:player-identification-enrichment
  'target_pid', // nfl-v1,scripts/process-plays,enrich:player-identification-enrichment
  'yard_line_100', // nfl-v1,nflfastr,charting
  'yard_line_end', // nfl-v1
  'yard_line_number', // nfl-v1
  'yard_line_side', // nfl-v1
  'yard_line_start', // nfl-v1
  'yards_after_catch', // enrich:yardage-stat-enrichment
  'yards_gained', // enrich:index,enrich:success-metric-enrichment,enrich:yardage-stat-enrichment
  'yards_to_go' // nfl-v1,nflfastr,charting,enrich:success-metric-enrichment
])

/**
 * Check whether a field is owned by a more-authoritative source and so must be
 * protected from Sportradar overwrites.
 * @param {string} field_name - Field name to check
 * @returns {boolean} True if the field is protected from Sportradar overwrites
 */
export const is_sportradar_protected_field = (field_name) => {
  return SPORTRADAR_PROTECTED_FIELDS.has(field_name)
}
