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
 * @param {NflPlaysRow[]} rows - The rows being inserted, for the column set
 * @returns {object} knex merge object mapping every column to its update value
 */
export const build_plays_merge = (table, rows) => {
  const merge = {}
  for (const column of collect_columns(rows)) {
    merge[column] = merge_value(table, column)
  }

  return merge
}

/**
 * Build the ON CONFLICT ... DO UPDATE ... WHERE predicate that suppresses a
 * write when the incoming row would change nothing.
 *
 * Without this, every import pass rewrites every row it re-reads, so
 * nfl_plays.updated advances whether or not any value actually changed and the
 * column carries no signal about the play data. The finalization watermark
 * guard keys on that column, so it is only a truthful key once this predicate
 * is in place. The write suppression is the secondary benefit; the truthful
 * key is the point.
 *
 * Two exclusions are load-bearing and must survive any later simplification:
 *
 * - `updated` is EXCLUDED FROM THE COMPARISON. It carries a fresh timestamp on
 *   every pass, so a predicate including it always reports a change and the
 *   whole mechanism reverts to unconditional rewriting.
 * - `drive_sequence` is compared against ITS COALESCE MERGE TARGET, not against
 *   bare EXCLUDED. The merge resolves it as
 *   COALESCE(EXCLUDED.drive_sequence, <table>.drive_sequence), so on a poll
 *   where the feed has not yet tagged the play, EXCLUDED is null while the
 *   value the merge would write is the stored one. Comparing against EXCLUDED
 *   would read that as a change on every poll of every untagged play and
 *   defeat the predicate. Comparing each column against the value the merge
 *   would ACTUALLY WRITE is the general rule; drive_sequence is just the
 *   column where it currently differs.
 *
 * Both sides are built from the same column set and the same merge_value() the
 * merge object uses, so the predicate cannot drift away from what the merge
 * writes.
 *
 * Row-wise IS DISTINCT FROM is null-safe in both directions: a column that is
 * null on both sides reads as unchanged, and a null-to-value or value-to-null
 * transition reads as a change. A plain `<>` comparison would yield null for
 * either and suppress a real write.
 *
 * @param {string} table - Target table name, for the qualified column reference
 * @param {NflPlaysRow[]} rows - The rows being inserted, for the column set
 * @returns {object|null} knex raw predicate, or null when the batch carries no
 *   comparable column
 */
export const build_plays_change_predicate = (table, rows) => {
  const columns = [...collect_columns(rows)].filter(
    (column) => column !== 'updated'
  )

  if (!columns.length) {
    return null
  }

  const stored = columns.map((column) =>
    db.raw('??.??', [table, column]).toString()
  )
  const incoming = columns.map((column) =>
    merge_value(table, column).toString()
  )

  return db.raw(
    `(${stored.join(', ')}) is distinct from (${incoming.join(', ')})`
  )
}

const collect_columns = (rows) => {
  const columns = new Set()
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column)
    }
  }

  return columns
}

const merge_value = (table, column) =>
  column === 'drive_sequence'
    ? db.raw('coalesce(EXCLUDED.??, ??.??)', [column, table, column])
    : db.raw('EXCLUDED.??', [column])

export default build_plays_merge
