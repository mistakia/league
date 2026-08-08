// Epoch-column sweep — ADVISORY, not a gate.
//
// Finds integer columns that STORE an instant, by reading their VALUES rather
// than their names. It is the value-side counterpart to the `timestamp_type`
// rule in db/tools/audit-schema-conformance.mjs, which keys on a `_at`/`_time`/
// `_ts`/`_date` name suffix and therefore cannot see an instant called
// `updated`, `submitted` or `accepted`.
//
// Its OUTPUT IS AN INPUT: the columns it reports are candidates for the audit's
// static `known_time_columns` set. Run it, review the candidates, promote the
// true instants into that set, and the audit reports them thereafter with no
// database connection of its own. That indirection is the point — the audit
// parses a checked-out schema file and takes no connection by design, so that it
// runs anywhere and is safe in CI. Putting a value-side rule inside it would
// forfeit exactly that property, so the sweep lives out here instead.
//
// Consequently this MUST NOT be wired into a publish gate, a CI check, or a
// per-cluster clean check. It EXITS ZERO whether or not it finds anything;
// findings are candidates for review, never a build failure. Same posture as the
// sibling advisory db/tools/scan-source-leakage.mjs.
//
// Usage:
//   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//     node db/tools/scan-epoch-columns.mjs
//   ... --json        # machine output
//   ... --all         # include columns the audit already flags
//   ... --selftest    # verify the calendar-shape discriminator, no DB needed
//
// The port above is the `base db` league tunnel's local port; a working
// `base db query league` means the tunnel is up. Never pass a credential on the
// command line.
//
// Exit codes: 0 = ran successfully (with or without findings), 1 = --selftest
// discriminator failure, 2 = could not read the statistics.

import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// `#db` is imported LAZILY, inside the scan. It resolves the environment config
// at module load, so a static import makes --selftest — which touches no
// database — fail on a missing config-undefined.json before main() ever runs.
const load_db = async () => (await import('#db')).default

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const audit_path = path.join(__dirname, 'audit-schema-conformance.mjs')

// --- the range ---------------------------------------------------------------

// Unix SECONDS, roughly 2001-09 to 2049-03. Wide enough to hold anything this
// schema plausibly stores and narrow enough to exclude ordinary counts, cents
// and ids. Milliseconds are three orders of magnitude above it and are NOT swept
// here — league_team_daily_values.timestamp is the known millisecond column, and
// type is not a unit, so a ms column has to be recognised by hand.
const EPOCH_MIN = 1.0e9
const EPOCH_MAX = 2.5e9

// --- the discriminator -------------------------------------------------------

// A naive range test is NOT usable on this schema. `esbid`, `gsis_game_id` and
// `ngs_game_id` are YYYYMMDDHH-shaped game identifiers, which land squarely
// inside the band above: 2009091000 is "2009-09-10 hour 00", not an instant.
// Measured against league_production, a range-only predicate returns them for
// every partition of nfl_plays and historical_injury_index — dozens of false
// positives that would drown the real findings.
//
// So the sweep rejects the SHAPE rather than trusting the range. A value is
// calendar-shaped when its leading EIGHT digits decompose into a plausible
// YYYYMMDD. The two populations do not overlap in practice: a real unix second
// in this band has leading digits of 1600-1800 (a seconds count, not a year), so
// it fails the year test and survives to be reported.
//
// The trailing two digits are deliberately NOT constrained to an hour. They are
// documented as YYYYMMDDHH and mostly are, but this feed also emits a game
// SEQUENCE there — 2010080851 and 2011081151 are live esbid values with a
// "51" — so an hour test rejects a handful of real identifiers, and since a
// column is only excluded when EVERY sampled value matches, one such value put
// the entire esbid family back into the report. Measured: with the hour test the
// sweep returned 26 candidates including esbid on eight tables; without it, 15.
//
// The residual false positive is an instant in 1.9e9-2.1e9 whose digits also
// read as a date — 1993010112, about 2033-02-20. Nothing in this schema is
// there, and the sweep is advisory and reviewed, so the trade is worth it.
function is_calendar_shaped(value) {
  if (!Number.isInteger(value)) return false
  if (value < 1000000000 || value > 9999999999) return false
  const year = Math.floor(value / 1000000)
  const month = Math.floor(value / 10000) % 100
  const day = Math.floor(value / 100) % 100
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= 31
}

// A column is calendar-shaped only when EVERY sampled value is. One value that
// is not a plausible date is enough to say the column is not an identifier of
// that form, which fails toward reporting rather than toward silence.
function looks_like_identifier(values) {
  return values.length > 0 && values.every(is_calendar_shaped)
}

function run_selftest() {
  // The last two entries carry a game SEQUENCE rather than an hour, which is
  // the case that put the whole esbid family back into the report.
  const identifiers = [
    2009091000, 2026010413, 2002080301, 1970091800, 2010080851, 2011081151
  ]
  const instants = [1600631981, 1773696938, 1659626302, 1685981188]
  const failures = []

  for (const v of identifiers) {
    if (!is_calendar_shaped(v)) failures.push(`${v} should be calendar-shaped`)
  }
  for (const v of instants) {
    if (is_calendar_shaped(v))
      failures.push(`${v} should NOT be calendar-shaped`)
  }
  if (looks_like_identifier(instants)) {
    failures.push('an all-instant column should not read as an identifier')
  }
  if (!looks_like_identifier(identifiers)) {
    failures.push('an all-identifier column should read as an identifier')
  }
  // A column mixing the two is not an identifier -- fail toward reporting.
  if (looks_like_identifier([...identifiers, ...instants])) {
    failures.push('a mixed column should not read as an identifier')
  }

  for (const f of failures) console.error(`  FAIL ${f}`)
  console.log(
    failures.length
      ? `selftest FAILED (${failures.length})`
      : 'selftest OK -- discriminator separates YYYYMMDDHH ids from unix seconds'
  )
  return failures.length ? 1 : 0
}

// --- statistics --------------------------------------------------------------

// pg_stats rather than a table scan: the histogram and the most-common-value
// list are already computed, so this reads a few thousand sampled values instead
// of hundreds of millions of rows. The cost is the sweep's one real blind spot —
// a column with no analyzed rows has no entry here at all, so an all-NULL or
// never-analyzed instant is invisible. That is the standing reason this feeds a
// reviewed static set rather than gating anything.
//
// Partition children are excluded: they duplicate their parent's columns, so
// including them reports the same column once per partition (nfl_plays has 116).
const STATS_SQL = `
  SELECT
    s.tablename AS table_name,
    s.attname AS column_name,
    c.data_type,
    array_agg(v.value) AS sampled
  FROM pg_stats s
  JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = s.tablename
   AND c.column_name = s.attname
  JOIN pg_class pc
    ON pc.relname = s.tablename
   AND pc.relnamespace = 'public'::regnamespace
  CROSS JOIN LATERAL (
    SELECT unnest(
      coalesce(s.histogram_bounds::text::text[], '{}')
      || coalesce(s.most_common_vals::text::text[], '{}')
    ) AS value
  ) v
  WHERE s.schemaname = 'public'
    AND c.data_type IN ('integer', 'bigint', 'numeric')
    AND v.value ~ '^[0-9]+$'
    AND NOT EXISTS (
      SELECT 1 FROM pg_inherits i WHERE i.inhrelid = pc.oid
    )
  GROUP BY 1, 2, 3
`

// The audit is the oracle for what is already reported, rather than a second
// copy of its rule here -- a reimplementation would drift from it silently.
function already_flagged_columns() {
  let raw
  try {
    raw = execFileSync('node', [audit_path, '--json'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    })
  } catch (err) {
    // The audit exits non-zero whenever it has findings, which is the normal
    // case; its stdout is still the report.
    raw = err.stdout
  }
  if (!raw) return new Set()
  const parsed = JSON.parse(raw)
  return new Set(
    parsed.findings
      .filter((f) => f.rule === 'timestamp_type')
      .map((f) => `${f.table}.${f.column}`)
  )
}

async function scan({ include_flagged, db }) {
  const flagged = already_flagged_columns()
  const { rows } = await db.raw(STATS_SQL)

  const candidates = []
  for (const row of rows) {
    const values = row.sampled
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
    if (!values.length) continue

    const lo = Math.min(...values)
    const hi = Math.max(...values)
    if (lo < EPOCH_MIN || hi > EPOCH_MAX) continue
    if (looks_like_identifier(values)) continue

    const key = `${row.table_name}.${row.column_name}`
    const is_flagged = flagged.has(key)
    if (is_flagged && !include_flagged) continue

    candidates.push({
      table: row.table_name,
      column: row.column_name,
      type: row.data_type,
      min: lo,
      max: hi,
      min_decoded: new Date(lo * 1000).toISOString(),
      max_decoded: new Date(hi * 1000).toISOString(),
      already_flagged: is_flagged
    })
  }

  candidates.sort((a, b) =>
    `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`)
  )
  return candidates
}

function report(candidates, argv) {
  if (argv.json) {
    console.log(JSON.stringify({ candidates }, null, 2))
    return
  }

  console.log('epoch-column sweep -- ADVISORY, exits 0 regardless of findings')
  console.log(
    'Candidates feed known_time_columns in db/tools/audit-schema-conformance.mjs.'
  )
  console.log(
    argv.all
      ? 'Showing ALL candidates, including those the audit already reports.'
      : 'Showing candidates the audit does NOT already report (--all for every one).'
  )
  console.log('')
  console.log(`candidates: ${candidates.length}`)

  if (!candidates.length) return
  console.log('')
  for (const c of candidates) {
    const seen = c.already_flagged ? ' [already reported by the audit]' : ''
    console.log(
      `  ${c.table}.${c.column} [${c.type}] ` +
        `${c.min_decoded.slice(0, 10)} .. ${c.max_decoded.slice(0, 10)}${seen}`
    )
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('json', { type: 'boolean', default: false })
    .option('all', {
      type: 'boolean',
      default: false,
      description: 'Include columns the audit already reports'
    })
    .option('selftest', {
      type: 'boolean',
      default: false,
      description: 'Verify the calendar-shape discriminator (no database)'
    })
    .help().argv

  if (argv.selftest) {
    process.exitCode = run_selftest()
    return
  }

  let db
  try {
    db = await load_db()
    const candidates = await scan({ include_flagged: argv.all, db })
    report(candidates, argv)
    process.exitCode = 0
  } catch (err) {
    // Distinct from a finding: the sweep could not read the statistics at all.
    console.error(`could not read column statistics: ${err.message}`)
    process.exitCode = 2
  } finally {
    // The knex pool keeps the event loop alive, so a script importing #db does
    // not exit on its own when the work finishes.
    if (db) await db.destroy()
  }
}

// Called bare rather than through is_main: everything under db/ is run by hand
// from a relative path, and is_main compares process.argv[1] verbatim against the
// resolved module path, so it would silently never enter main().
main()
