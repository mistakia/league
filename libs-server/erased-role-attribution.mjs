import db from '#db'

/**
 * Rows whose passer attribution the system HELD and then DESTROYED.
 *
 * WHY THIS IS NOT THE RESIDUAL CHECK. The long-standing oracle for this class
 * grades `_gsis IS NOT NULL AND _pid IS NULL` -- a row we can still resolve.
 * The obvious repair for that reading is to clear the `_gsis`, which turns the
 * monitor GREEN by deleting the last record of who the player was. So the
 * residual shape cannot distinguish "resolved" from "erased", and it grades the
 * destructive repair as success.
 *
 * This predicate is the complement and moves in the opposite direction: a row
 * the changelog shows once carried a passer, which now holds NEITHER a `_pid`
 * NOR a `_gsis`. Clearing a resolvable residual moves a row FROM the resolvable
 * bucket INTO this one, so the repair that satisfies the old oracle fails this
 * one. That is the whole reason it exists.
 *
 * SCOPED TO NOPL AND CONV deliberately. On PASS rows the same clear-and-rewrite
 * cycle is transient and healthy -- measured 2026-08-22, 5,457 of 5,458 cleared
 * PASS rows were repopulated. On NOPL and CONV it was repopulated at zero. The
 * scope also keeps deliberate clears of bogus stamps on RUSH rows out of the
 * finding, which are a repair rather than a loss.
 *
 * THE CHANGELOG IS THE RECOVERY SOURCE for the erased bucket, not just the
 * detector: `play_changelog.previous_value` holds what was deleted, and for a
 * row with no surviving `_gsis` it is the only place the identity still exists.
 * Any healer for this condition MUST import this function rather than
 * re-spelling the predicate, so detector and healer cannot drift.
 *
 * @typedef {object} erased_role_attribution_row
 * @property {string} play_type - the play type the counts group by
 * @property {number} scanned - rows the changelog shows were once attributed
 * @property {number} erased - of those, rows now holding neither _pid nor _gsis
 * @property {number} resolvable - of those, rows still holding a _gsis
 * @property {number} restored - of those, rows holding a _pid again
 */

// The one spelling of "the changelog shows this row was once attributed".
// Both the detector and the healer below build on this, so neither can drift
// from the other -- the failure the module docstring warns about.
//
// Role-specific spelling: passer uses the PRE-conform names only, and the
// table carries 215 distinct column names across three conventions. Verify the
// spelling per column before trusting a zero.
const CLEARED_COLUMN_NAMES = ['psr_gsis', 'psr_pid']

const with_cleared = (/** @type {any} */ query) =>
  query
    .distinct('esbid', 'play_id')
    .from('play_changelog')
    .whereIn('column_name', CLEARED_COLUMN_NAMES)
    .whereNull('new_value')
    .whereNotNull('previous_value')

/**
 * @param {object} [args]
 * @param {string[]} [args.play_types] - play types to grade
 * @returns {Promise<erased_role_attribution_row[]>} one row per play type
 */
export const erased_role_attribution_by_play_type = async ({
  play_types = ['NOPL', 'CONV']
} = {}) => {
  const rows = await db
    .with('cleared', with_cleared)
    .select('nfl_plays.play_type')
    .count({ scanned: '*' })
    .from('cleared')
    .join('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'cleared.esbid').andOn(
        'nfl_plays.play_id',
        '=',
        'cleared.play_id'
      )
    })
    .whereIn('nfl_plays.play_type', play_types)
    .select(
      db.raw(
        `count(*) FILTER (WHERE nfl_plays.passer_pid IS NULL AND nfl_plays.passer_gsis_player_id IS NULL) AS erased`
      ),
      db.raw(
        `count(*) FILTER (WHERE nfl_plays.passer_pid IS NULL AND nfl_plays.passer_gsis_player_id IS NOT NULL) AS resolvable`
      ),
      db.raw(
        `count(*) FILTER (WHERE nfl_plays.passer_pid IS NOT NULL) AS restored`
      )
    )
    .groupBy('nfl_plays.play_type')

  return rows.map((row) => ({
    play_type: row.play_type,
    scanned: Number(row.scanned),
    erased: Number(row.erased),
    resolvable: Number(row.resolvable),
    restored: Number(row.restored)
  }))
}

/**
 * The ERASED bucket at row grain, with what the changelog still holds for it.
 *
 * This is the healer's half of the module. It shares `with_cleared` with the
 * detector above rather than re-spelling the predicate, which is the coupling
 * the module docstring requires: a healer built on its own copy of the
 * predicate would drift the moment either side is edited, and the drift would
 * be invisible because both would still return plausible numbers.
 *
 * Only rows holding NEITHER a `_pid` NOR a `_gsis` are returned. A row that
 * still holds a `_gsis` is resolvable by ordinary enrichment and is not this
 * function's business -- restoring it here would write a changelog value over
 * one the feed may have since corrected.
 *
 * @typedef {object} erased_role_attribution_restore_row
 * @property {number} esbid
 * @property {number} play_id
 * @property {string} play_type
 * @property {string|null} previous_pid - passer_pid as it was before the clear
 * @property {string|null} previous_gsis - passer_gsis as it was before the clear
 *
 * @param {object} [args]
 * @param {string[]} [args.play_types] - play types to restore
 * @returns {Promise<erased_role_attribution_restore_row[]>}
 */
export const erased_role_attribution_restore_rows = async ({
  play_types = ['NOPL', 'CONV']
} = {}) => {
  const rows = await db
    .with('cleared', with_cleared)
    .select(
      'nfl_plays.esbid',
      'nfl_plays.play_id',
      'nfl_plays.play_type',
      'previous_pid.previous_value as previous_pid',
      'previous_gsis.previous_value as previous_gsis'
    )
    .from('cleared')
    .join('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'cleared.esbid').andOn(
        'nfl_plays.play_id',
        '=',
        'cleared.play_id'
      )
    })
    .joinRaw(
      `left join lateral (
         select previous_value from play_changelog
         where esbid = nfl_plays.esbid and play_id = nfl_plays.play_id
           and column_name = 'psr_pid'
           and new_value is null and previous_value is not null
         limit 1
       ) previous_pid on true`
    )
    .joinRaw(
      `left join lateral (
         select previous_value from play_changelog
         where esbid = nfl_plays.esbid and play_id = nfl_plays.play_id
           and column_name = 'psr_gsis'
           and new_value is null and previous_value is not null
         limit 1
       ) previous_gsis on true`
    )
    .whereIn('nfl_plays.play_type', play_types)
    .whereNull('nfl_plays.passer_pid')
    .whereNull('nfl_plays.passer_gsis_player_id')

  return rows.map((row) => ({
    esbid: Number(row.esbid),
    play_id: Number(row.play_id),
    play_type: row.play_type,
    previous_pid: row.previous_pid || null,
    previous_gsis: row.previous_gsis || null
  }))
}
