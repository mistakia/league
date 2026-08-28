// @ts-check
import db from '#db'

/*
  What points at a `player` row, and which of two rows should therefore survive
  a fold.

  Both questions are answered by the same enumeration, which is why they live
  together: the counts that choose the survivor are also the "before" snapshot
  the post-merge audit compares against, and after the merge there is no way to
  recover what they were.
*/

/**
 * Every table carrying a `pid` column, minus `player` itself.
 *
 * Enumerated at run time rather than listed, for the same reason
 * collapse-duplicate-minted-player-rows enumerates it: a hand-written copy
 * silently stops covering a table added later, and it fails by finding fewer
 * references than exist -- which reads as a clean, cheap merge.
 *
 * @returns {Promise<string[]>}
 */
export const get_pid_referencing_tables = async () => {
  const { rows } = await db.raw(
    `SELECT table_name FROM information_schema.columns
     WHERE column_name = 'pid' AND table_schema = 'public' AND table_name <> 'player'
     ORDER BY 1`
  )
  return rows.map((/** @type {{ table_name: string }} */ row) => row.table_name)
}

/**
 * @typedef {object} PidReferenceCount
 * @property {number} total
 * @property {Array<{ table: string, rows: number }>} by_table
 */

/**
 * The counted references for one pid.
 *
 * Throws rather than returning a zero: every caller looks up a pid it asked to
 * have counted, so a miss means the count and the lookup disagree about the
 * population -- and a silent zero there would read as "nothing points at this
 * row", which is the one answer that makes an unsafe merge look safe.
 *
 * @param {Map<string, PidReferenceCount>} references
 * @param {string} pid
 * @returns {PidReferenceCount}
 */
export const reference_count_for = (references, pid) => {
  const entry = references.get(pid)
  if (!entry) throw new Error(`no reference count was captured for ${pid}`)
  return entry
}

/**
 * Per-table reference counts for each pid.
 *
 * @param {{ pids: string[], tables: string[] }} params
 * @returns {Promise<Map<string, PidReferenceCount>>}
 */
export const count_references = async ({ pids, tables }) => {
  /** @type {Map<string, PidReferenceCount>} */
  const counts = new Map(pids.map((pid) => [pid, { total: 0, by_table: [] }]))
  for (const table of tables) {
    const { rows } = await db.raw(
      `SELECT pid, count(*) AS rows FROM "${table}" WHERE pid = ANY(?) GROUP BY 1`,
      [pids]
    )
    for (const row of rows) {
      const entry = reference_count_for(counts, row.pid)
      entry.total += Number(row.rows)
      entry.by_table.push({ table, rows: Number(row.rows) })
    }
  }
  return counts
}

/**
 * Which half survives, returned as `[survivor, folded]`.
 *
 * A question about churn, not about identity. A pid is an opaque immutable
 * serial (generate-player-id.mjs), so neither half is more canonical than the
 * other and the merged row inherits both halves' values either way. Keeping the
 * more-referenced half simply repoints fewer rows. Ties break on pid so a dry
 * run and its apply agree.
 *
 * @param {{ rows: Array<Record<string, any>>, references: Map<string, PidReferenceCount> }} params
 * @returns {Array<Record<string, any>>}
 */
export const choose_survivor_by_reference_count = ({ rows, references }) => {
  const [left, right] = rows
  const left_total = reference_count_for(references, left.pid).total
  const right_total = reference_count_for(references, right.pid).total
  if (left_total !== right_total) {
    return left_total > right_total ? [left, right] : [right, left]
  }
  return left.pid < right.pid ? [left, right] : [right, left]
}
