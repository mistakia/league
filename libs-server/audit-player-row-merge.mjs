// @ts-check
import db from '#db'

import {
  count_references,
  reference_count_for
} from '#libs-server/player-pid-references.mjs'
import {
  is_real_birth_date,
  is_absent_player_value
} from '#libs-server/player-birth-date.mjs'

/*
  The no-data-loss audit for a player-row fold, run against what the database
  actually holds after the merge rather than against what the merge believed it
  was doing.

  Three invariants, and each fails in a different direction:

  - UNION OF VALUES. For every column, if either half held a value, the survivor
    must still hold one, and it must be one of the two the halves held -- not a
    third value invented by the merge. This is what catches a real value losing
    a tie-break to an absence, which is exactly the sentinel defect.
  - REFERENCE CONSERVATION. Every row that pointed at either half must now point
    at the survivor, per table. `player_changelog` is allowed to GROW, because
    the merge writes its own audit rows there; every other table must land on
    the exact sum, so a repoint that silently dropped rows is visible.
  - NO SURVIVING FOLD. The folded pid must be gone from `player` and referenced
    by nothing, or the merge left an orphan.

  This can only run in the process that performed the merge, because reference
  conservation compares against counts captured before the write. There is no
  after-the-fact variant: the per-table before-counts are not recoverable once
  the rows have moved, and a check that cannot run must not return green.
*/

/**
 * @typedef {object} MergePlan
 * @property {string} survivor_pid
 * @property {string} folded_pid
 * @property {Record<string, any>} survivor_row - the survivor as it was BEFORE the merge
 * @property {Record<string, any>} folded_row - the folded half as it was BEFORE the merge
 * @property {Map<string, { total: number, by_table: Array<{ table: string, rows: number }> }>} before_references
 * @property {Record<string, any>} [expected_columns] - columns the repair WRITES after the merge, and the value each must hold
 * @property {string[]} [deliberate_columns] - columns the repair overwrites, exempted from the union-of-values check
 */

/**
 * @param {{ plans: MergePlan[], tables: string[] }} params
 * @returns {Promise<string[]>} human-readable failures; empty means the audit passed
 */
export const audit_player_row_merges = async ({ plans, tables }) => {
  const failures = []

  for (const plan of plans) {
    const [survivor_row] = await db('player').where('pid', plan.survivor_pid)
    if (!survivor_row) {
      failures.push(`${plan.survivor_pid} is gone after its own merge`)
      continue
    }

    // knex types the row by its table, so a column read from a runtime-built
    // list has to be widened before it can index it.
    const survivor = /** @type {Record<string, any>} */ (survivor_row)
    const deliberate = new Set(plan.deliberate_columns || [])

    for (const column of Object.keys(plan.survivor_row)) {
      if (column === 'pid' || deliberate.has(column)) continue

      const candidates = [
        plan.survivor_row[column],
        plan.folded_row[column]
      ].filter((value) => !is_absent_player_value(value))
      if (!candidates.length) continue

      const after = survivor[column]
      if (is_absent_player_value(after)) {
        failures.push(
          `${plan.survivor_pid}.${column} lost its value — held ${JSON.stringify(candidates)}, now ${JSON.stringify(after)}`
        )
        continue
      }
      if (!candidates.some((value) => String(value) === String(after))) {
        failures.push(
          `${plan.survivor_pid}.${column} holds ${JSON.stringify(after)}, which neither half held (${JSON.stringify(candidates)})`
        )
      }
    }

    for (const [column, expected] of Object.entries(
      plan.expected_columns || {}
    )) {
      if (survivor[column] !== expected) {
        failures.push(
          `${plan.survivor_pid} holds ${column} ${survivor[column]}, expected ${expected}`
        )
      }
    }

    /*
      Both repair classes exist to unwind a split where one half carried the
      sentinel, so a survivor still holding it means the fold kept the wrong
      half's date -- the one outcome neither repair is allowed to produce.
    */
    if (!is_real_birth_date(survivor.date_of_birth)) {
      failures.push(
        `${plan.survivor_pid} carries birth date ${survivor.date_of_birth}`
      )
    }

    const [folded] = await db('player').where('pid', plan.folded_pid)
    if (folded) failures.push(`${plan.folded_pid} survived its own fold`)
  }

  const after_references = await count_references({
    pids: plans.flatMap((plan) => [plan.survivor_pid, plan.folded_pid]),
    tables
  })

  for (const plan of plans) {
    const orphaned = reference_count_for(after_references, plan.folded_pid)
    if (orphaned.total > 0) {
      failures.push(
        `${plan.folded_pid} is still referenced by ${orphaned.by_table.map((row) => `${row.table}(${row.rows})`).join(', ')}`
      )
    }

    /** @type {Map<string, number>} */
    const expected = new Map()
    for (const pid of [plan.survivor_pid, plan.folded_pid]) {
      for (const entry of reference_count_for(plan.before_references, pid)
        .by_table) {
        expected.set(entry.table, (expected.get(entry.table) || 0) + entry.rows)
      }
    }
    const after = new Map(
      reference_count_for(after_references, plan.survivor_pid).by_table.map(
        (entry) => [entry.table, entry.rows]
      )
    )

    for (const [table, rows] of expected) {
      const landed = after.get(table) || 0
      if (table === 'player_changelog') {
        if (landed < rows) {
          failures.push(
            `${plan.survivor_pid} lost changelog rows in ${table}: ${rows} before, ${landed} after`
          )
        }
        continue
      }
      if (landed !== rows) {
        failures.push(
          `${plan.survivor_pid} reference count changed in ${table}: expected ${rows}, found ${landed}`
        )
      }
    }
  }

  return failures
}
