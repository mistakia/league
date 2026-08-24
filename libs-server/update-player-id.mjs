import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import is_main from './is-main.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('update-player-id')
enable_debug_namespaces('update-player-id')

/*
  The unique key column sets that cover `column_name`, one array per index.

  This is what decides whether a row can be repointed. Repointing is a plain
  UPDATE of the pid, so it can only fail one way: a unique key that includes the
  pid column already has a row under `new_pid` with the same values on the rest
  of that key. Anything else moves freely.

  Partial and expression indexes are excluded rather than approximated -- their
  predicate would have to be re-evaluated per row to know whether a conflict is
  real, and treating them as blocking would strand rows that were never in
  conflict. INCLUDE columns are excluded too (`ord <= indnkeyatts`): they are
  payload, not part of the uniqueness.
*/
// Exported so a caller can ask, BEFORE the repoint, how many rows this rule
// will refuse to move and therefore delete. An audit that re-derives the rule
// instead of sharing it is auditing a copy that can drift.
export const get_unique_key_columns = async function ({
  table_name,
  column_name
}) {
  const { rows } = await db.raw(
    `
    -- attname is the name type, and the driver has no parser for a name array,
    -- so an uncast array_agg arrives as the raw literal string. Cast to text.
    SELECT array_agg(a.attname::text ORDER BY k.ord) AS columns
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE n.nspname = current_schema()
      AND c.relname = ?
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND k.ord <= i.indnkeyatts
    GROUP BY i.indexrelid
    HAVING ? = ANY(array_agg(a.attname::text))
  `,
    [table_name, column_name]
  )
  return rows.map((row) => row.columns)
}

/*
  Why this is not a presence check.

  This used to skip a table outright whenever `new_pid` appeared in it at all,
  and skip it BEFORE the delete below -- so the folded pid's rows were neither
  moved nor removed. Once the caller deleted the folded `player` row they became
  orphans: rows pointing at a pid that no longer exists.

  The survivor almost always appears in the same table as the row being folded
  into it, so this fired constantly. It was measured against production on
  2026-08-24: 21 pids hold orphaned `player_changelog` rows, one of them 1,175
  rows, and the class is not specific to changelog. 14 of the pid-carrying
  tables have no unique key on the pid column at all -- `transactions`,
  `waivers`, `poaches`, `draft`, `player_changelog` and the `_history` tables --
  which is to say the append-only record of what happened to a player. For every
  one of those a repoint was always safe and always correct, and the presence
  check refused it anyway.

  What replaces it is a conflict check. A row moves unless some unique key
  genuinely blocks it; the ones that are blocked are deleted, which is what the
  presence check was reaching for and is correct only for rows the survivor
  already has an equivalent of.
*/
export const build_conflict_predicates = ({
  table_name,
  column_name,
  key_sets
}) =>
  key_sets.map((columns) => {
    // A key of the pid column ALONE means one row per player, so any row under
    // `new_pid` blocks every row under `current_pid`. That falls out of `rest`
    // being empty rather than needing its own branch.
    const rest = columns.filter((column) => column !== column_name)
    const matches = rest
      .map((column) => `x."${column}" IS NOT DISTINCT FROM t."${column}"`)
      .join(' AND ')

    return `NOT EXISTS (SELECT 1 FROM "${table_name}" x WHERE x."${column_name}" = ?${
      matches ? ` AND ${matches}` : ''
    })`
  })

const update_player_id = async function ({ current_pid, new_pid }) {
  if (!current_pid) {
    throw new Error('current_pid is required')
  }

  if (!new_pid) {
    throw new Error('new_pid is required')
  }

  const player_rows = await db('player').where({ pid: new_pid })
  const player_row = player_rows[0]

  if (!player_row) {
    log(`pid ${new_pid} not found`)
    return
  }

  // get all tables with pid columns, except for player table
  const tables = await db.raw(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (column_name LIKE '%_pid' OR column_name = 'pid')
      AND table_schema = current_schema()
      AND table_name != 'player'
    GROUP BY table_name, column_name
  `)

  for (const table of tables.rows) {
    const table_name = table.table_name
    const column_name = table.column_name

    const key_sets = await get_unique_key_columns({ table_name, column_name })
    const conflict_predicates = build_conflict_predicates({
      table_name,
      column_name,
      key_sets
    })
    const conflict_clause = conflict_predicates.length
      ? ` AND ${conflict_predicates.join(' AND ')}`
      : ''

    const result = await db.raw(
      `
      WITH updated AS (
        UPDATE "${table_name}" t
        SET "${column_name}" = ?
        WHERE t."${column_name}" = ?${conflict_clause}
        RETURNING 1
      )
      SELECT count(*) AS count FROM updated
    `,
      [new_pid, current_pid, ...conflict_predicates.map(() => new_pid)]
    )
    const rows_updated = result.rows[0].count

    // Whatever a unique key refused to move. The survivor already holds an
    // equivalent row for each of these, so dropping them is the merge doing
    // what it says; a row that reached here for any OTHER reason would be a
    // silent loss, which is why the repoint is conflict-gated rather than
    // presence-gated.
    const rows_dropped = await db(table_name)
      .where(column_name, current_pid)
      .del()
    log(
      `${table_name} ${column_name} rows updated: ${rows_updated}, rows dropped as conflicting: ${rows_dropped}`
    )
  }
}

export default update_player_id

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('current_pid', {
      describe: 'Current player ID',
      type: 'string',
      demandOption: true
    })
    .option('new_pid', {
      describe: 'New player ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

if (is_main(import.meta.url)) {
  const main = async () => {
    const argv = initialize_cli()

    await update_player_id({
      current_pid: argv.current_pid,
      new_pid: argv.new_pid
    })

    process.exit(0)
  }

  main()
}
