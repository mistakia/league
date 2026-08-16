import db from '#db'

/**
 * Build the ON CONFLICT update set for a plays upsert, protecting drive_sequence
 * from being erased by a null.
 *
 * The live worker re-polls the full playlist for an in-progress game every 60
 * seconds and re-upserts every play, and getPlayData always sets the drive_sequence
 * key -- null for any play the NFL feed has not yet tagged with a
 * driveSequenceNumber. A blanket .merge() therefore writes those nulls over
 * whatever is already stored, so a value the enrichment (or an earlier poll)
 * had correctly computed is destroyed on the next poll. That is live data loss,
 * not a stale read.
 *
 * Every other column keeps blanket-merge semantics; only drive_sequence resolves as
 * COALESCE(EXCLUDED.drive_sequence, <table>.drive_sequence), which makes the write
 * monotonic: a real value may replace a null, never the reverse. A genuine
 * renumber still lands, because a source supplying drive_sequence supplies a
 * non-null value.
 *
 * This lives here rather than in scripts/import-plays-nfl-v1.mjs so it can be
 * tested without importing that script, whose transitive graph reaches the
 * private submodule's NGS module (via finalize-game.mjs ->
 * import-nfl-games-ngs.mjs). CI checks out the repo without submodules, so a
 * spec importing that script dies with ERR_MODULE_NOT_FOUND on the runner while
 * passing locally. Note the path is spelled out in prose deliberately: writing
 * the literal import alias here would make this module match a grep for private
 * importers and misreport it as one.
 *
 * @param {string} table - Target table name, for the qualified column reference
 * @param {Array} rows - The rows being inserted, for the column set
 * @returns {Object} knex merge object mapping every column to its update value
 */
export const build_plays_merge = (table, rows) => {
  const columns = new Set()
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column)
    }
  }

  const merge = {}
  for (const column of columns) {
    merge[column] =
      column === 'drive_sequence'
        ? db.raw('coalesce(EXCLUDED.??, ??.??)', [column, table, column])
        : db.raw('EXCLUDED.??', [column])
  }

  return merge
}

export default build_plays_merge
