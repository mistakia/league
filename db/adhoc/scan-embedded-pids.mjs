/**
 * Immutable player-id (pid) re-key -- embedded-pid scan / rewrite / verify.
 *
 * pids also live INSIDE free-text and JSON columns (JSON keys, values, array
 * elements), invisible to the typed `%_pid` equality enumeration -- the sharpest
 * failure mode of the re-key. This driver operates over EVERY text/json/jsonb
 * column via `col::text` and the old-pid pattern.
 *
 * Why a driver and not the cutover SQL: rewriting an embedded pid is a per-value
 * substring MAPPING over ~40k old->new pairs, which is not expressible as an
 * equality-join UPDATE. The rewrite runs in the cutover window (importers paused),
 * right before the SQL swap.
 *
 * Audit-history carve-out: player_changelog.prev / player_changelog.new hold pid
 * strings AS change history. Rewriting their old pids would falsify that history,
 * so they are scanned/reported but NEVER rewritten, and excluded from the stale
 * oracle.
 *
 * WINDOW COST (size-aware, mirrors prep-02): a `col::text ~ pattern` filter is a full
 * sequential scan of the column, so scanning every text/varchar/json column of every giant
 * (player_changelog 67.6M, the prop_* betting tables 12-37M, ...) is untenable INSIDE the
 * downtime window. Because the rewrite is idempotent (disjoint old/new namespaces), the
 * heavy pass runs LIVE in Phase A over ALL tables; the in-window pass uses `--skip-large`
 * to touch only tables at or below the size threshold (the actual embedded-pid producers --
 * config, user_data_views, user_plays_views -- are all small). Large tables' embedded state
 * rests on the Phase-A live pass + the post-cutover coverage oracle (verify, which scans
 * EVERYTHING outside the window). No giant currently holds any embedded pid at all.
 *
 * Modes:
 *   (default)     scan   -- report every candidate column + match count; write inventory
 *   --apply       rewrite old pids -> new_pid across candidate columns (idempotent)
 *   --apply --skip-large  rewrite only tables <= threshold (the cheap in-window pass)
 *   --verify      exit non-zero if any real old pid still lingers (post-cutover oracle)
 *
 * Usage:
 *   NODE_ENV=production node db/adhoc/scan-embedded-pids.mjs
 *   NODE_ENV=production node db/adhoc/scan-embedded-pids.mjs --apply              # Phase A (live)
 *   NODE_ENV=production node db/adhoc/scan-embedded-pids.mjs --apply --skip-large # in-window
 *   NODE_ENV=production node db/adhoc/scan-embedded-pids.mjs --verify
 *   PID_REKEY_THRESHOLD=5 ... (override the 100K threshold; used by the seeded rehearsal)
 *
 * Prereq for --apply/--verify: prep-01 populated player.new_pid.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'

const log = debug('scan-embedded-pids')
debug.enable('scan-embedded-pids')

// Size threshold (pg_class.reltuples): with --skip-large, a table whose estimate exceeds
// this is left for the Phase-A live pass + the coverage oracle. MUST match prep-02's and
// the cutover's 100K. Overridable for the seeded rehearsal only.
const THRESHOLD = Number(process.env.PID_REKEY_THRESHOLD || 100000)

// Old person-pid shape. POSIX form for the SQL detection filter; JS form (global)
// for extracting individual tokens from a value during rewrite/verify.
const OLD_PID_POSIX =
  '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'
const OLD_PID_TOKEN =
  /[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}/g

// Columns that hold pids as immutable audit history -- never rewritten.
const AUDIT_CARVE_OUT = new Set([
  'player_changelog.prev',
  'player_changelog.new'
])

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const resolve_inventory_path = () => {
  let dir = path.join(__dirname, '..', '..')
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'CLAUDE.md')) &&
      fs.existsSync(path.join(dir, 'scratch'))
    ) {
      return path.join(
        dir,
        'scratch',
        'league',
        'pid-rekey',
        'embedded-pid-inventory.json'
      )
    }
    dir = path.dirname(dir)
  }
  return null
}

// Every text/json/jsonb column, minus columns that hold a BARE pid value (handled
// by an equality remap, not a substring rewrite): `pid`, `%_pid`, and the
// `pid_a`/`pid_b` pair-correlation columns (matched by `pid_%`). The latter are
// re-keyed by the cutover's LEAST/GREATEST orientation logic -- rewriting them
// here independently would violate the pid_a < pid_b CHECK.
const enumerate_candidate_columns = async ({ skip_large = false } = {}) => {
  // Join pg_class for reltuples so --skip-large can drop giant tables (whose col::text
  // scan would be an untenable sequential scan). Exclude partition PARENTS (relkind 'p'):
  // a parent scan/UPDATE reads/routes every child, so enumerating both parent and children
  // double-scans the whole partition family (nfl_plays alone = ~80M rows x dozens of text
  // columns -- the dominant cost of the verify pass). The leaf children ('r') cover exactly
  // the same rows, and --skip-large still drops the giants because each child's own
  // reltuples estimate exceeds the threshold.
  const { rows } = await db.raw(
    `
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN pg_namespace ns ON ns.nspname = c.table_schema
    JOIN pg_class pc ON pc.relname = c.table_name AND pc.relnamespace = ns.oid
    WHERE c.table_schema = current_schema()
      AND pc.relkind <> 'p'
      AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
      AND c.column_name <> 'pid'
      AND c.column_name NOT LIKE '%\\_pid'
      AND c.column_name NOT LIKE 'pid\\_%'
      ${skip_large ? 'AND pc.reltuples <= ?' : ''}
    ORDER BY c.table_name, c.column_name
    `,
    skip_large ? [THRESHOLD] : []
  )
  return rows
}

// The old->new pid map lives in `player` as two columns whose names depend on the
// phase: pre-cutover it is pid(old) -> new_pid(new); post-cutover the swap renamed
// them to legacy_pid(old) -> pid(new). Detect whichever staging shape is present so
// the same rewrite/verify code works before and after the swap.
const build_old_to_new_map = async () => {
  const has_column = async (name) => {
    const { rows } = await db.raw(
      `SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'player' AND column_name = ? LIMIT 1`,
      [name]
    )
    return rows.length > 0
  }
  const has_new_pid = await has_column('new_pid')
  const has_legacy_pid = await has_column('legacy_pid')
  let old_col
  let new_col
  if (has_new_pid && has_legacy_pid) {
    // Both staging columns present = ambiguous phase (e.g. a botched cutover renamed
    // new_pid -> pid but left an old new_pid behind). Fail loud rather than pick a
    // branch and build a garbage map that would misclassify real stale pids.
    throw new Error(
      'player has BOTH new_pid and legacy_pid -- ambiguous migration phase; resolve before running'
    )
  } else if (has_new_pid) {
    old_col = 'pid'
    new_col = 'new_pid'
  } else if (has_legacy_pid) {
    old_col = 'legacy_pid'
    new_col = 'pid'
  } else {
    throw new Error(
      'player has neither new_pid nor legacy_pid -- run prep-01 first'
    )
  }
  // Exclude rows with a NULL on either side. The `<>` below already drops them via SQL
  // three-valued logic, so these whereNotNull calls are explicit belt-and-suspenders, not
  // a behavior change. A NULL new_pid (a prep-01 population miss) is a gap the map cannot
  // represent either way; it is caught by the coverage tool's null-new / legacy checks,
  // not here.
  const rows = await db('player')
    .whereNotNull(old_col)
    .whereNotNull(new_col)
    .whereRaw('?? <> ??', [old_col, new_col])
    .select({ old_pid: old_col, new_pid: new_col })
  const map = new Map()
  for (const { old_pid, new_pid } of rows) map.set(old_pid, new_pid)
  return map
}

const match_count = async (table, column) => {
  const { rows } = await db.raw(
    `SELECT count(*)::int AS n FROM ?? WHERE ??::text ~ ?`,
    [table, column, OLD_PID_POSIX]
  )
  return rows[0].n
}

// Distinct textual values in a column that contain an old-pid-shaped token.
const distinct_matching_values = async (table, column) => {
  const { rows } = await db.raw(
    `SELECT DISTINCT ??::text AS val FROM ?? WHERE ??::text ~ ?`,
    [column, table, column, OLD_PID_POSIX]
  )
  return rows.map((r) => r.val)
}

const rewrite_value = (val, map) =>
  val.replace(OLD_PID_TOKEN, (token) => map.get(token) || token)

const cast_for = (data_type) =>
  data_type === 'jsonb' ? '::jsonb' : data_type === 'json' ? '::json' : ''

const scan = async ({ inventory_path }) => {
  const columns = await enumerate_candidate_columns()
  const report = []
  for (const { table_name, column_name, data_type } of columns) {
    const n = await match_count(table_name, column_name)
    if (n === 0) continue
    const key = `${table_name}.${column_name}`
    const classification = AUDIT_CARVE_OUT.has(key)
      ? 'audit-carve-out (never rewritten)'
      : 'rewrite-target'
    report.push({
      table: table_name,
      column: column_name,
      data_type,
      matches: n,
      classification
    })
    log(
      `${key} (${data_type}): ${n} row(s) with an embedded old pid -- ${classification}`
    )
  }
  if (!report.length)
    log('no embedded old pids found in any text/json/jsonb column')
  if (inventory_path) {
    fs.mkdirSync(path.dirname(inventory_path), { recursive: true })
    fs.writeFileSync(inventory_path, JSON.stringify(report, null, 2) + '\n')
    log(`inventory written to ${inventory_path}`)
  }
  return report
}

const apply = async ({ skip_large = false } = {}) => {
  const map = await build_old_to_new_map()
  log(`loaded ${map.size} old->new pid mappings`)
  if (skip_large)
    log(
      `--skip-large: tables with reltuples > ${THRESHOLD} deferred to the Phase-A live pass + coverage oracle`
    )
  const columns = await enumerate_candidate_columns({ skip_large })
  let total_rows = 0
  for (const { table_name, column_name, data_type } of columns) {
    const key = `${table_name}.${column_name}`
    if (AUDIT_CARVE_OUT.has(key)) {
      const n = await match_count(table_name, column_name)
      if (n > 0)
        log(`SKIP ${key}: audit carve-out, ${n} row(s) left as history`)
      continue
    }
    const values = await distinct_matching_values(table_name, column_name)
    if (!values.length) continue
    const cast = cast_for(data_type)
    for (const old_val of values) {
      const new_val = rewrite_value(old_val, map)
      if (new_val === old_val) continue // pattern-shaped but no known pid inside
      const { rowCount } = await db.raw(
        `UPDATE ?? SET ?? = ?${cast} WHERE ??::text = ?`,
        [table_name, column_name, new_val, column_name, old_val]
      )
      total_rows += rowCount || 0
    }
    log(
      `${key}: rewrote embedded pids across ${values.length} distinct value(s)`
    )
  }
  log(`apply complete: ${total_rows} row(s) rewritten`)
  return total_rows
}

// Post-cutover oracle: a REAL old pid (present in the map) still embedded anywhere
// outside the audit carve-out is a failure. A pattern-shaped string that is not a
// real old pid is reported as a warning, not a failure.
const verify = async () => {
  const map = await build_old_to_new_map()
  const columns = await enumerate_candidate_columns()
  const failures = []
  const warnings = []
  for (const { table_name, column_name } of columns) {
    const key = `${table_name}.${column_name}`
    if (AUDIT_CARVE_OUT.has(key)) continue
    const values = await distinct_matching_values(table_name, column_name)
    for (const val of values) {
      const tokens = val.match(OLD_PID_TOKEN) || []
      const real = tokens.filter((t) => map.has(t))
      if (real.length)
        failures.push(
          `${key}: still embeds old pid(s) ${[...new Set(real)].join(', ')}`
        )
      else
        warnings.push(
          `${key}: pattern-shaped non-pid token(s) present (not a real pid)`
        )
    }
  }
  for (const w of warnings) log(`WARN ${w}`)
  if (failures.length) {
    for (const f of failures) log(`FAIL ${f}`)
    return false
  }
  log(
    'verify OK: no real old pid embedded in any text/json/jsonb column outside the audit carve-out'
  )
  return true
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('apply', { type: 'boolean', default: false })
    .option('skip-large', { type: 'boolean', default: false })
    .option('verify', { type: 'boolean', default: false })
    .help().argv

  let exit_code = 0
  try {
    if (argv.apply) {
      await apply({ skip_large: argv['skip-large'] })
    } else if (argv.verify) {
      const ok = await verify()
      if (!ok) exit_code = 1
    } else {
      await scan({ inventory_path: resolve_inventory_path() })
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

export { scan, apply, verify, enumerate_candidate_columns, AUDIT_CARVE_OUT }
