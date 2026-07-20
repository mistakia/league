/**
 * Immutable player-id (pid) re-key -- additive prep, step 2 of 2.
 *
 * Pre-remaps every HIGH-VOLUME pid-bearing leaf onto `player.new_pid`, ONE TABLE PER
 * TRANSACTION with a VACUUM (ANALYZE) between tables to bound MVCC bloat, then records
 * each verified table in the `_pid_rekey_prep_sentinel` table. This absorbs the bulk of
 * the re-key volume OUTSIDE the downtime transaction, so the cutover swap touches only
 * the small standalone leaves and stays short. It runs live and ahead of the window.
 *
 * TARGET SET (the size predicate the cutover mirrors exactly):
 *   a pid leaf (relkind 'r', excluding player / player_pair_correlations) is pre-remapped
 *   here iff it is EITHER
 *     (a) a partition child (relispartition) -- the nfl_plays_year_* / player_gamelogs_year_*
 *         / projections_index_* / historical_injury_index_* families: individually ~90K
 *         rows but collectively multi-million, and we want the whole family out of the
 *         window regardless of any single child's size; OR
 *     (b) a STANDALONE leaf whose pg_class.reltuples exceeds THRESHOLD (100K) -- the 11
 *         giants (player_changelog 67.6M, scoring_format_player_gamelogs 15.8M, ...) plus
 *         ~16 midsize tables that are NOT partitioned, which a partition-only predicate
 *         would miss and leave for a monolithic in-swap UPDATE; OR
 *     (c) any table ALREADY in the sentinel -- so once a table is pre-remapped it is
 *         re-verified on every subsequent run even if its reltuples later drifts below
 *         THRESHOLD (closes a straggler gap for a boundary-sized table that also receives
 *         writes; the cutover would otherwise exclude it from the swap and never re-check).
 *
 * Why NOT pure size: the nfl_plays_year_* children are ~90K each (below 100K), so a
 * size-only predicate would push their ~2.4M combined rows back into the swap window --
 * the exact volume the two-phase design exists to avoid. Keeping relispartition as an
 * explicit "always pre-remap partitioned families" clause is more robust than tuning a
 * threshold to straddle partition sizes.
 *
 * SENTINEL: after remapping + verifying a table clean, upsert (table_name, row_estimate,
 * verified_at) into `_pid_rekey_prep_sentinel`. The cutover trusts this record instead of
 * re-scanning the table: it checks the sentinel covers every prep-02-scoped table (cheap
 * catalog lookup, no data scan) and remaps only the leaves ABSENT from the sentinel.
 *
 * Partition PARENTS (relkind 'p') are never touched -- an UPDATE on a parent cascades
 * monolithically to every child.
 *
 * Why a driver and not a `.sql`: `yarn db:exec` wraps a file in a single transaction, and
 * (a) VACUUM cannot run inside a transaction block, (b) a single monolithic transaction
 * over the multi-million-row tables would roughly double the largest tables at once and
 * bloat WAL for hours. Per-table separate transactions + VACUUM is the mitigation.
 *
 * Idempotent and safe to re-run: the old and new pid namespaces are disjoint (old carries
 * the -YYYY-YYYY-MM-DD tail, new the -NNNNNN serial), so an already-remapped row can never
 * re-match `t.<col> = player.pid`, and team/unit rows (new_pid = pid) are no-ops. A
 * crashed/partial run is resumed by simply running again. Re-running in the downtime window
 * (after importers are paused) clears any stragglers inserted since the live run.
 *
 * Prereq: 2026-07-19-pid-rekey-prep-01-newpid.sql has run (player.new_pid populated,
 * sentinel table created).
 *
 * Usage:
 *   NODE_ENV=production node db/adhoc/pid-rekey-prep-02-remap.mjs            # remap
 *   NODE_ENV=production node db/adhoc/pid-rekey-prep-02-remap.mjs --dry-run  # report only
 *   NODE_ENV=production node db/adhoc/pid-rekey-prep-02-remap.mjs --no-vacuum
 *   PID_REKEY_THRESHOLD=5 ... (override the 100K size threshold; used by the seeded rehearsal)
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'

const log = debug('pid-rekey-prep-02-remap')
debug.enable('pid-rekey-prep-02-remap')

// Size threshold (pg_class.reltuples) above which a STANDALONE pid leaf is pre-remapped
// here rather than in the swap. MUST match the literal in the cutover SQL
// (2026-07-19-pid-rekey-cutover.sql). Overridable for the seeded rehearsal only.
const THRESHOLD = Number(process.env.PID_REKEY_THRESHOLD || 100000)

// Old person-pid shape, used only to count residual un-remapped rows.
const OLD_PID_PATTERN =
  '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'

// Every HIGH-VOLUME pid-bearing leaf: relkind 'r' (a sub-partitioned intermediate parent
// -- relkind 'p' -- is excluded, since UPDATE on it cascades to all children), excluding
// player (the map itself) and player_pair_correlations (re-keyed by the cutover's
// LEAST/GREATEST logic), that is a partition child OR a standalone leaf over THRESHOLD OR
// already recorded in the sentinel. Returns pid columns grouped by table (one txn/table).
// The (relispartition OR reltuples > THRESHOLD OR in-sentinel) predicate is the exact set
// the cutover's sentinel-coverage guard requires and the swap loop excludes -- one shared
// definition, so the two never drift.
const enumerate_targets = async () => {
  const { rows } = await db.raw(
    `
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN pg_namespace ns ON ns.nspname = c.table_schema
    JOIN pg_class pc ON pc.relname = c.table_name AND pc.relnamespace = ns.oid
    WHERE c.table_schema = current_schema()
      AND (c.column_name LIKE '%\\_pid' OR c.column_name = 'pid' OR c.column_name LIKE 'pid\\_%')
      AND pc.relkind = 'r'
      AND c.table_name <> 'player'
      AND c.table_name <> 'player_pair_correlations'
      -- Never pre-remap a table that carries a live FK referencing player(pid): its pid
      -- would be set to a new_pid value that does not yet exist in player.pid (the key is
      -- not swapped until the cutover), violating the FK and aborting the txn. Those two
      -- tables (ngs_prospect_scores_history/_index, both <100K) are handled by the cutover
      -- swap loop, which drops the FKs first. If such a table ever grows past the threshold
      -- it cannot be pre-remapped here (FK) nor cheaply swapped -- the cutover's sentinel-
      -- coverage guard then aborts fail-closed, forcing FK-aware handling to be added.
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class fr ON fr.oid = con.confrelid
        WHERE con.contype = 'f' AND con.conrelid = pc.oid AND fr.relname = 'player'
      )
      AND (
        pc.relispartition
        OR pc.reltuples > ?
        OR EXISTS (SELECT 1 FROM _pid_rekey_prep_sentinel s WHERE s.table_name = c.table_name)
      )
    ORDER BY c.table_name, c.column_name
    `,
    [THRESHOLD]
  )
  // Group columns by table so each table is one transaction. pid_a/pid_b never appear here
  // (player_pair_correlations is excluded), so the grouping only ever holds pid / %_pid.
  const by_table = new Map()
  for (const { table_name, column_name } of rows) {
    if (!by_table.has(table_name)) by_table.set(table_name, [])
    by_table.get(table_name).push(column_name)
  }
  return by_table
}

const table_row_estimate = async (table) => {
  const { rows } = await db.raw(
    `SELECT pc.reltuples::bigint AS n
       FROM pg_class pc
       JOIN pg_namespace ns ON ns.oid = pc.relnamespace
      WHERE ns.nspname = current_schema() AND pc.relname = ?`,
    [table]
  )
  return rows.length ? Number(rows[0].n) : 0
}

const residual_count = async (table, column) => {
  const { rows } = await db.raw(
    `SELECT count(*)::int AS n FROM ?? WHERE ?? ~ ?`,
    [table, column, OLD_PID_PATTERN]
  )
  return rows[0].n
}

// Rows still on an old pid whose player row STILL EXISTS -- remappable but not yet
// remapped, the true post-remap failure condition.
const remappable_residual_count = async (table, column) => {
  const { rows } = await db.raw(
    `SELECT count(*)::int AS n FROM ?? t
       WHERE t.?? ~ ?
         AND EXISTS (SELECT 1 FROM player p WHERE p.pid = t.??)`,
    [table, column, OLD_PID_PATTERN, column]
  )
  return rows[0].n
}

// Pre-existing dangling old pids: value matches the old shape but no surviving player
// row carries it (a historical merge deleted the losing player and update-player-id.mjs
// left the reference behind). These have no map entry, can never be remapped, and
// predate this migration -- reported, never fatal.
const orphan_residual_count = async (table, column) => {
  const { rows } = await db.raw(
    `SELECT count(*)::int AS n FROM ?? t
       WHERE t.?? ~ ?
         AND NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = t.??)`,
    [table, column, OLD_PID_PATTERN, column]
  )
  return rows[0].n
}

const sentinel_upsert = async (table) => {
  const est = await table_row_estimate(table)
  await db.raw(
    `INSERT INTO _pid_rekey_prep_sentinel (table_name, row_estimate, verified_at)
       VALUES (?, ?, now())
     ON CONFLICT (table_name)
       DO UPDATE SET row_estimate = EXCLUDED.row_estimate, verified_at = now()`,
    [table, est]
  )
}

const remap = async ({ dry_run = false, vacuum = true }) => {
  // Pre-flight: new_pid must exist and be fully populated, and the sentinel table must
  // exist (prep-01 ran).
  const { rows: col_rows } = await db.raw(
    `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'player' AND column_name = 'new_pid'`
  )
  if (col_rows[0].n === 0) {
    throw new Error('player.new_pid is missing -- run prep-01 first')
  }
  const { rows: sentinel_rows } = await db.raw(
    `SELECT to_regclass('_pid_rekey_prep_sentinel') IS NOT NULL AS present`
  )
  if (!sentinel_rows[0].present) {
    throw new Error(
      '_pid_rekey_prep_sentinel is missing -- run prep-01 first (it creates the sentinel)'
    )
  }
  const { rows: null_rows } = await db.raw(
    `SELECT count(*)::int AS n FROM player WHERE new_pid IS NULL`
  )
  if (null_rows[0].n > 0) {
    throw new Error(
      `player.new_pid has ${null_rows[0].n} NULL row(s) -- prep-01 did not complete`
    )
  }

  const by_table = await enumerate_targets()
  log(
    `threshold=${THRESHOLD}; ${by_table.size} high-volume pid leaf table(s) to pre-remap`
  )

  let total_updated = 0
  for (const [table, columns] of by_table) {
    if (dry_run) {
      for (const column of columns) {
        const n = await residual_count(table, column)
        log(`[dry-run] ${table}.${column}: ${n} row(s) still on an old pid`)
      }
      continue
    }

    // One transaction per table: remap every pid column, then commit.
    let table_updated = 0
    await db.transaction(async (trx) => {
      for (const column of columns) {
        const { rowCount } = await trx.raw(
          `UPDATE ?? AS t
              SET ?? = player.new_pid
             FROM player
            WHERE t.?? = player.pid
              AND t.?? IS NOT NULL`,
          [table, column, column, column]
        )
        table_updated += rowCount || 0
        log(`${table}.${column}: remapped ${rowCount || 0} row(s)`)
      }
    })
    total_updated += table_updated

    // Bound bloat before moving to the next table. VACUUM cannot run inside a
    // transaction, so it is a bare autocommit statement here.
    if (vacuum) {
      await db.raw(`VACUUM (ANALYZE) ??`, [table])
      log(`${table}: vacuumed`)
    }

    // Per-table verify: no REMAPPABLE row left on an old pid. Pre-existing orphans
    // (player row already gone) are reported but not fatal -- they carry no map entry.
    for (const column of columns) {
      const remappable = await remappable_residual_count(table, column)
      if (remappable > 0) {
        throw new Error(
          `${table}.${column}: ${remappable} remappable row(s) still match the old-pid pattern after remap (player still exists)`
        )
      }
      const orphaned = await orphan_residual_count(table, column)
      if (orphaned > 0) {
        log(
          `${table}.${column}: ${orphaned} pre-existing orphaned old pid(s) (player already gone; not remappable, left as-is)`
        )
      }
    }

    // Record the table as pre-remapped + verified. The cutover reads this instead of
    // re-scanning the (potentially multi-million-row) table inside the swap.
    await sentinel_upsert(table)
    log(`${table}: sentinel recorded`)
  }

  log(
    dry_run
      ? 'dry-run complete'
      : `remap complete: ${total_updated} row(s) updated; all ${by_table.size} target table(s) verified clean and recorded in the sentinel`
  )
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('dry-run', { type: 'boolean', default: false })
    .option('vacuum', { type: 'boolean', default: true })
    .help().argv

  let exit_code = 0
  try {
    await remap({ dry_run: argv['dry-run'], vacuum: argv.vacuum })
  } catch (err) {
    log(err)
    exit_code = 1
  }
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}

export default remap
