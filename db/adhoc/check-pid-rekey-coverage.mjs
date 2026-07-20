/**
 * Immutable player-id (pid) re-key -- coverage / parity oracle.
 *
 * Proves -- by machine, not by human reading -- that the re-key was complete and
 * non-lossy. Exits non-zero on the first violation.
 *
 * Post-cutover checks (default):
 *   * PRIMARY KEY: player.pid itself carries zero old-shape values and every value
 *     matches the new-person or team/unit shape (the key must actually have swapped).
 *   * STALE: no enumerated %_pid / pid / pid_% column (any table except player) still
 *     holds an old-shape person pid THAT MAPS TO A LIVE PLAYER (present in legacy_pid)
 *     -- i.e. a reference that should have been remapped and was not. An old-shape value
 *     with no live player is a pre-existing orphan (historical merge) and is a warning.
 *   * EMBEDDED: no real old pid embedded in any text/json/jsonb column outside the
 *     player_changelog audit carve-out (delegates to scan-embedded-pids.verify).
 *   * ARRAY: array-of-text columns (outside both typed and embedded passes) carry no
 *     old-person-shape token.
 *   * PRESERVED: player.legacy_pid is non-null and unique, one row per player, and
 *     every value is an old-person or team/unit shape -- so every old pid survives.
 *   * REFERENTIAL: the two ngs_prospect_scores_* FKs have zero orphans; and
 *     player_pair_correlations has zero pid_a >= pid_b rows.
 *   * DANGLING (report-only): per %_pid column, count values absent from player.pid
 *     (pre-existing orphans are expected; a remappable stale value fails STALE).
 *
 * Row-count parity across all pid tables needs a pre-migration baseline:
 *   NODE_ENV=production node db/adhoc/check-pid-rekey-coverage.mjs --snapshot before.json  # run BEFORE prep
 *   NODE_ENV=production node db/adhoc/check-pid-rekey-coverage.mjs --compare  before.json   # run AFTER cutover
 *
 * Usage:
 *   NODE_ENV=production node db/adhoc/check-pid-rekey-coverage.mjs
 */

import fs from 'fs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import { verify as verify_embedded } from './scan-embedded-pids.mjs'

const log = debug('check-pid-rekey-coverage')
debug.enable('check-pid-rekey-coverage,scan-embedded-pids')

const OLD_PERSON = '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
// Unanchored form for substring detection inside a composite ::text rendering (e.g. a
// text[] renders as `{PID,PID}` -- the anchored OLD_PERSON can never match that).
const OLD_PERSON_SUBSTR =
  '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'
const NEW_PERSON = '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$'
const TEAM_UNIT = '^[A-Z]{2,3}(-(OFF|DEF|DST))?$'

// Every bare-pid column: `pid`, `%_pid`, and the `pid_a`/`pid_b` pair-correlation
// columns (via `pid_%`). Including pid_a/pid_b closes the oracle blind spot -- they
// match neither `pid` nor `%_pid`, so a stale value there would otherwise go unseen.
const enumerate_pid_columns = async ({ include_player = false } = {}) => {
  const { rows } = await db.raw(
    `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND (column_name LIKE '%\\_pid' OR column_name = 'pid' OR column_name LIKE 'pid\\_%')
         ${include_player ? '' : "AND table_name <> 'player'"}
       ORDER BY table_name, column_name`
  )
  return rows
}

const scalar = async (raw_sql, bindings = []) => {
  const { rows } = await db.raw(raw_sql, bindings)
  return Number(rows[0].n)
}

const snapshot = async (out_path) => {
  const cols = await enumerate_pid_columns({ include_player: true })
  const counts = {}
  for (const { table_name } of cols) {
    if (counts[table_name] === undefined) {
      counts[table_name] = await scalar(
        `SELECT count(*)::bigint AS n FROM ??`,
        [table_name]
      )
    }
  }
  fs.writeFileSync(out_path, JSON.stringify(counts, null, 2) + '\n')
  log(
    `snapshot of ${Object.keys(counts).length} pid tables written to ${out_path}`
  )
}

const compare = async (baseline_path, errors) => {
  const baseline = JSON.parse(fs.readFileSync(baseline_path, 'utf8'))
  for (const [table, before] of Object.entries(baseline)) {
    const after = await scalar(`SELECT count(*)::bigint AS n FROM ??`, [table])
    if (after !== Number(before)) {
      errors.push(`row count changed for ${table}: ${before} -> ${after}`)
    }
  }
  log(`compared row counts for ${Object.keys(baseline).length} tables`)
}

const run_checks = async ({ errors, warnings }) => {
  const columns = await enumerate_pid_columns()

  // STALE + DANGLING per column. A STALE FAILURE is an old-shape value that maps to a
  // live player (present in player.legacy_pid) -- it should have been remapped and was
  // not. An old-shape value NOT in legacy_pid is a pre-existing orphan (its player row
  // was deleted by a historical merge before this migration; no map entry exists), so
  // it is reported as a warning, not a failure.
  for (const { table_name, column_name } of columns) {
    const stale = await scalar(
      `SELECT count(*)::int AS n FROM ?? t
         WHERE t.?? ~ ?
           AND EXISTS (SELECT 1 FROM player p WHERE p.legacy_pid = t.??)`,
      [table_name, column_name, OLD_PERSON, column_name]
    )
    if (stale > 0) {
      errors.push(
        `${table_name}.${column_name}: ${stale} row(s) on an old-shape pid that maps to a live player (should have been remapped)`
      )
    }
    const orphan_stale = await scalar(
      `SELECT count(*)::int AS n FROM ?? t
         WHERE t.?? ~ ?
           AND NOT EXISTS (SELECT 1 FROM player p WHERE p.legacy_pid = t.??)`,
      [table_name, column_name, OLD_PERSON, column_name]
    )
    if (orphan_stale > 0) {
      warnings.push(
        `${table_name}.${column_name}: ${orphan_stale} pre-existing orphaned old pid(s) (no live player; not remappable)`
      )
    }
    const dangling = await scalar(
      `SELECT count(*)::int AS n FROM ?? t
         WHERE t.?? IS NOT NULL
           AND t.?? !~ ?
           AND NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = t.??)`,
      [table_name, column_name, column_name, TEAM_UNIT, column_name]
    )
    if (dangling > 0) {
      warnings.push(
        `${table_name}.${column_name}: ${dangling} value(s) absent from player.pid (pre-existing orphans?)`
      )
    }
  }

  // PRESERVED: legacy_pid retains every old pid, one-to-one.
  const player_count = await scalar(`SELECT count(*)::int AS n FROM player`)
  const distinct_pid = await scalar(
    `SELECT count(DISTINCT pid)::int AS n FROM player`
  )
  const null_legacy = await scalar(
    `SELECT count(*)::int AS n FROM player WHERE legacy_pid IS NULL`
  )
  const distinct_legacy = await scalar(
    `SELECT count(DISTINCT legacy_pid)::int AS n FROM player WHERE legacy_pid IS NOT NULL`
  )
  const bad_legacy = await scalar(
    `SELECT count(*)::int AS n FROM player WHERE legacy_pid IS NOT NULL AND legacy_pid !~ ? AND legacy_pid !~ ?`,
    [OLD_PERSON, TEAM_UNIT]
  )
  if (distinct_pid !== player_count)
    errors.push(
      `player.pid not unique: ${distinct_pid} distinct of ${player_count}`
    )
  if (null_legacy > 0)
    errors.push(`${null_legacy} player row(s) have NULL legacy_pid`)
  if (distinct_legacy !== player_count)
    errors.push(
      `legacy_pid not one-to-one: ${distinct_legacy} distinct of ${player_count}`
    )
  if (bad_legacy > 0)
    errors.push(
      `${bad_legacy} legacy_pid value(s) match neither the old-person nor team/unit shape`
    )

  // PRIMARY KEY: player.pid itself must be fully on the NEW scheme -- the single most
  // important target of the whole re-key, and the one column every dependent check
  // trusts as authoritative. The enumerate_pid_columns() STALE loop above excludes
  // player, and the legacy_pid checks only prove the OLD pid was retained, so without
  // this an unswapped player.pid (old value still in pid, identical value in legacy_pid)
  // would pass every other check. No person pid may still carry the old shape; every
  // value must match the new-person or team/unit shape (DST rows are never re-keyed).
  const stale_player_pid = await scalar(
    `SELECT count(*)::int AS n FROM player WHERE pid ~ ?`,
    [OLD_PERSON]
  )
  if (stale_player_pid > 0)
    errors.push(
      `player.pid: ${stale_player_pid} row(s) still carry an old-shape pid (the key was not swapped)`
    )
  const bad_player_pid = await scalar(
    `SELECT count(*)::int AS n FROM player WHERE pid !~ ? AND pid !~ ?`,
    [NEW_PERSON, TEAM_UNIT]
  )
  if (bad_player_pid > 0)
    errors.push(
      `player.pid: ${bad_player_pid} value(s) match neither the new-person nor team/unit shape`
    )

  // ARRAY BLIND SPOT: array-of-text columns (data_type ARRAY) are covered by neither
  // the typed %_pid pass nor the embedded text/json/jsonb pass. Enumerate them and
  // assert none carries an old-person-shape token, closing the gap by machine. (Clear
  // today: the only text[] columns hold opaque bookmaker source ids; other arrays are
  // numeric. Fail-loud if a future array column ever embeds a pid.)
  const { rows: array_cols } = await db.raw(`
    SELECT c.relname AS table_name, a.attname AS column_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    JOIN pg_type e ON e.oid = t.typelem
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
      AND a.attnum > 0 AND NOT a.attisdropped
      AND t.typcategory = 'A'
      AND e.typcategory = 'S'
    ORDER BY c.relname, a.attname
  `)
  for (const { table_name, column_name } of array_cols) {
    const arr_hit = await scalar(
      `SELECT count(*)::int AS n FROM ?? WHERE ??::text ~ ?`,
      [table_name, column_name, OLD_PERSON_SUBSTR]
    )
    if (arr_hit > 0)
      errors.push(
        `${table_name}.${column_name} (text[]): ${arr_hit} row(s) contain an old-person-shape token -- array columns are outside the embedded scanner; investigate`
      )
  }

  // REFERENTIAL: ngs FKs + pair-correlations order.
  for (const t of [
    'ngs_prospect_scores_history',
    'ngs_prospect_scores_index'
  ]) {
    const orphans = await scalar(
      `SELECT count(*)::int AS n FROM ?? t WHERE t.pid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = t.pid)`,
      [t]
    )
    if (orphans > 0)
      errors.push(
        `${t}: ${orphans} pid(s) not present in player (FK would fail)`
      )
  }
  const bad_order = await scalar(
    `SELECT count(*)::int AS n FROM player_pair_correlations WHERE (pid_a)::text >= (pid_b)::text`
  )
  if (bad_order > 0)
    errors.push(
      `player_pair_correlations: ${bad_order} row(s) violate pid_a < pid_b`
    )

  // EMBEDDED: delegate to the embedded verifier.
  const embedded_ok = await verify_embedded()
  if (!embedded_ok)
    errors.push(
      'embedded-pid verify failed (see scan-embedded-pids output above)'
    )
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('snapshot', { type: 'string' })
    .option('compare', { type: 'string' })
    .help().argv

  const errors = []
  const warnings = []
  let exit_code = 0
  try {
    if (argv.snapshot) {
      await snapshot(argv.snapshot)
    } else {
      if (argv.compare) await compare(argv.compare, errors)
      await run_checks({ errors, warnings })

      for (const w of warnings) log(`WARN ${w}`)
      if (errors.length) {
        for (const e of errors) log(`FAIL ${e}`)
        exit_code = 1
      } else {
        log(
          'pid-rekey coverage OK: no stale or embedded old pids, legacy_pid preserved one-to-one, references intact'
        )
      }
    }
  } catch (err) {
    log(err)
    exit_code = 1
  }
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}

export default run_checks
