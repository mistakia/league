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

/**
 * @param {object} [args]
 * @param {string[]} [args.play_types] - play types to grade
 * @returns {Promise<erased_role_attribution_row[]>} one row per play type
 */
export const erased_role_attribution_by_play_type = async ({
  play_types = ['NOPL', 'CONV']
} = {}) => {
  const rows = await db
    .with('cleared', (query) => {
      query
        .distinct('esbid', 'play_id')
        .from('play_changelog')
        // Role-specific spelling: passer uses the PRE-conform names only, and
        // the table carries 215 distinct column names across three
        // conventions. Verify the spelling per column before trusting a zero.
        .whereIn('column_name', ['psr_gsis', 'psr_pid'])
        .whereNull('new_value')
        .whereNotNull('previous_value')
    })
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
