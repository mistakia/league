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
 *     truthy value, regardless of the overwrite flags. The authoritative
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
  'is_qb_scramble'
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
