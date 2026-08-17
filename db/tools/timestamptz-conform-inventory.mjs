// Regenerable consumer inventory for the timestamptz conformance cluster.
//
// WHY THIS EXISTS AND WHAT IT IS NOT. A hand-enumerated consumer list does not
// converge -- this program measured four sweeps over ten rounds each still
// turning up new sites, and one plan named 48 of the 170 files touching its
// tables. So this reports a DENOMINATOR (every file touching the cluster's
// tables) alongside the numerator (files naming a cluster column), and the gap
// between them is the part a reviewer still has to read.
//
// It is a discovery instrument, NOT a gate: it carries no verdict and lives in
// db/tools rather than db/gates deliberately (see db/gates/README.md).
//
// The retype half is the reason the arithmetic sweep below exists. A stale
// column NAME throws 42703 and every rename gate here catches it. A changed TYPE
// throws nothing: node-pg hands back a JavaScript Date where the code expects an
// epoch integer, so `now - row.timestamp` silently becomes NaN, `x * 1000`
// becomes a 13-digit nonsense, and every SQL-validity gate stays green because
// the SQL is still valid. Those sites can only be found by reading, so this
// ranks them to the top rather than leaving them mixed into the file list.
//
// usage:
//   node db/tools/timestamptz-conform-inventory.mjs            # summary
//   node db/tools/timestamptz-conform-inventory.mjs --json
//   node db/tools/timestamptz-conform-inventory.mjs --arithmetic  # retype risk only

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.resolve(__dirname, '../..')

// The eleven tables the cluster retypes. Kept as data rather than derived from
// the audit, because the audit is a suffix parser and this cluster exists partly
// because that parser under-reports (see cluster_columns below).
export const cluster_tables = [
  'config',
  'draft',
  'jobs',
  'league_team_daily_values',
  'league_team_forecast',
  'leagues',
  'matchups',
  'roster_asset_transformation',
  'seasons',
  'super_priority',
  'transactions'
]

// Every time-bearing column on those tables, enumerated FROM THE SCHEMA rather
// than from the audit. `audit: true` marks the sixteen the audit reports;
// `audit: false` marks the ones its `looks_like_time_column` suffix rule
// (/(_at|_time|_ts|timestamp|_date)$/) structurally cannot see. All eight of the
// invisible ones are `seasons` calendar instants stored as bigint unix seconds,
// and libs-server/context-docs/league-calendar.mjs consumes them in the SAME
// enumerated set as the four the audit does flag -- so conforming only the
// flagged members leaves one sort comparing Date objects against integers.
export const cluster_columns = [
  { table: 'config', column: 'updated_at', audit: true, rename: null },
  { table: 'draft', column: 'selection_timestamp', audit: true, rename: null },
  { table: 'jobs', column: 'timestamp', audit: true, rename: 'run_at' },
  {
    table: 'league_team_daily_values',
    column: 'timestamp',
    audit: true,
    rename: 'observed_at'
  },
  {
    table: 'league_team_forecast',
    column: 'timestamp',
    audit: true,
    rename: 'generated_at'
  },
  { table: 'leagues', column: 'processed_at', audit: true, rename: null },
  { table: 'leagues', column: 'archived_at', audit: true, rename: null },
  {
    table: 'matchups',
    column: 'simulation_timestamp',
    audit: true,
    rename: null
  },
  {
    table: 'roster_asset_transformation',
    column: 'occurred_at',
    audit: true,
    rename: null
  },
  { table: 'seasons', column: 'season_started_at', audit: true, rename: null },
  {
    table: 'seasons',
    column: 'ext_date',
    audit: true,
    rename: 'extension_deadline_at'
  },
  {
    table: 'seasons',
    column: 'rookie_draft_completed_at',
    audit: true,
    rename: null
  },
  {
    table: 'seasons',
    column: 'season_finalized_at',
    audit: true,
    rename: null
  },
  {
    table: 'super_priority',
    column: 'poach_timestamp',
    audit: true,
    rename: null
  },
  { table: 'super_priority', column: 'claimed_at', audit: true, rename: null },
  {
    table: 'transactions',
    column: 'timestamp',
    audit: true,
    rename: 'occurred_at'
  },

  // Invisible to the audit's suffix rule -- no _at/_time/_ts/_date ending.
  { table: 'seasons', column: 'draft_start', audit: false, rename: null },
  { table: 'seasons', column: 'tddate', audit: false, rename: null },
  {
    table: 'seasons',
    column: 'free_agency_period_start',
    audit: false,
    rename: null
  },
  {
    table: 'seasons',
    column: 'free_agency_period_end',
    audit: false,
    rename: null
  },
  {
    table: 'seasons',
    column: 'free_agency_live_auction_start',
    audit: false,
    rename: null
  },
  {
    table: 'seasons',
    column: 'free_agency_live_auction_end',
    audit: false,
    rename: null
  },
  {
    table: 'seasons',
    column: 'restricted_free_agency_period_start',
    audit: false,
    rename: null
  },
  {
    table: 'seasons',
    column: 'restricted_free_agency_period_end',
    audit: false,
    rename: null
  }
]

const scan_dirs = [
  'api',
  'app',
  'cli',
  'db',
  'jobs',
  'league-import',
  'libs-server',
  'libs-shared',
  'schemas',
  'scripts',
  'server',
  'test',
  'private'
]

const skip_dir = new Set(['node_modules', '.git', 'dist', 'tmp', '.yarn'])
const code_ext = new Set([
  '.mjs',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.sql',
  '.json'
])

function walk(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (skip_dir.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (code_ext.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

// A word-boundary match on the bare token. Deliberately loose: this is the
// DENOMINATOR, so a false positive costs a reviewer one glance and a false
// negative costs a production 42703.
function token_re(token) {
  return new RegExp(`\\b${escape_re(token)}\\b`)
}

function escape_re(token) {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Four cluster columns are named literally `timestamp`, a token that appears in
// this codebase for reasons having nothing to do with these tables -- imported
// vendor payloads, `simulation_timestamp`, the word in prose. Matching it bare
// put all four on 200+ files and made the numerator meaningless. So for that
// name only, require a reference that actually binds it to something: a
// table-qualified literal, an alias-qualified one, or a quoted identifier.
//
// This narrows the NUMERATOR only. The denominator still matches on the table
// name, so a payload-mapper that names the column with no table nearby stays
// inside the gap the report tells you to read -- which is the correct place for
// it, since that shape is exactly what a grep cannot resolve.
function column_re({ table, column }) {
  if (column !== 'timestamp') return token_re(column)
  return new RegExp(
    [
      `\\b${escape_re(table)}\\.["']?timestamp\\b`,
      `["'\`]${escape_re(table)}\\.timestamp["'\`]`,
      `"timestamp"`,
      `\\b[a-z_]{1,4}\\.["']?timestamp["']?\\b`
    ].join('|')
  )
}

// Arithmetic on an epoch integer is the defect class the retype creates and no
// gate reports. Each pattern is a shape that is correct against an integer and
// wrong against a Date.
const arithmetic_patterns = [
  { name: 'multiply_or_divide_1000', re: /[*/]\s*1000\b|\b1000\s*\*/ },
  { name: 'new_Date_from_epoch', re: /new Date\(\s*[A-Za-z_$][\w.$]*\s*\*/ },
  { name: 'dayjs_unix', re: /dayjs\.unix\(|\.unix\(\)/ },
  { name: 'numeric_coercion', re: /Number\(|parseInt\(|\+\s*\+/ },
  {
    name: 'bare_comparison',
    re: /[<>]=?\s*[A-Za-z_$][\w.$]*|[A-Za-z_$][\w.$]*\s*[<>]=?/
  },
  { name: 'subtraction', re: /-\s*[A-Za-z_$][\w.$]*|[A-Za-z_$][\w.$]*\s*-/ },
  { name: 'math_now', re: /Math\.round\(|Math\.floor\(|Date\.now\(\)/ }
]

function main() {
  const args = process.argv.slice(2)
  const as_json = args.includes('--json')
  const arithmetic_only = args.includes('--arithmetic')

  const files = scan_dirs.flatMap((d) => walk(path.join(repo_root, d)))

  const table_res = new Map(cluster_tables.map((t) => [t, token_re(t)]))
  const column_res = new Map(
    cluster_columns.map((c) => [`${c.table}.${c.column}`, column_re(c)])
  )

  const denominator = []
  const numerator = []
  const arithmetic_sites = []

  for (const file of files) {
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const rel = path.relative(repo_root, file)

    const tables_hit = cluster_tables.filter((t) => table_res.get(t).test(text))
    if (!tables_hit.length) continue
    denominator.push({ file: rel, tables: tables_hit })

    const columns_hit = cluster_columns
      .filter((c) => column_res.get(`${c.table}.${c.column}`).test(text))
      .map((c) => `${c.table}.${c.column}`)
    if (columns_hit.length) numerator.push({ file: rel, columns: columns_hit })

    // Arithmetic risk: only on LINES that name a cluster column, so the
    // ubiquitous comparison patterns do not flood the report.
    if (!columns_hit.length || path.extname(file) === '.sql') continue
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const named = cluster_columns.filter((c) =>
        column_res.get(`${c.table}.${c.column}`).test(line)
      )
      if (!named.length) continue
      const shapes = arithmetic_patterns
        .filter((p) => p.re.test(line))
        .map((p) => p.name)
      if (!shapes.length) continue
      arithmetic_sites.push({
        file: rel,
        line: i + 1,
        columns: named.map((c) => `${c.table}.${c.column}`),
        shapes,
        text: line.trim().slice(0, 160)
      })
    }
  }

  const result = {
    denominator_files: denominator.length,
    numerator_files: numerator.length,
    unread_gap: denominator.length - numerator.length,
    arithmetic_sites: arithmetic_sites.length,
    columns_total: cluster_columns.length,
    columns_audit_visible: cluster_columns.filter((c) => c.audit).length,
    columns_audit_blind: cluster_columns.filter((c) => !c.audit).length,
    denominator,
    numerator,
    arithmetic: arithmetic_sites
  }

  if (as_json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (arithmetic_only) {
    for (const site of arithmetic_sites) {
      console.log(
        `${site.file}:${site.line}  [${site.shapes.join(',')}]  ${site.columns.join(' ')}`
      )
      console.log(`    ${site.text}`)
    }
    console.log(`\n${arithmetic_sites.length} arithmetic sites`)
    return
  }

  console.log('timestamptz conformance -- consumer inventory')
  console.log(`  cluster tables            ${cluster_tables.length}`)
  console.log(
    `  cluster columns           ${result.columns_total} (${result.columns_audit_visible} audit-visible, ${result.columns_audit_blind} audit-blind)`
  )
  console.log(
    `  files touching tables     ${result.denominator_files}   <- DENOMINATOR`
  )
  console.log(`  files naming a column     ${result.numerator_files}`)
  console.log(`  gap needing a read        ${result.unread_gap}`)
  console.log(`  arithmetic risk sites     ${result.arithmetic_sites}`)
  console.log('\nfiles naming a cluster column:')
  for (const entry of numerator) {
    console.log(`  ${entry.file}`)
    console.log(`      ${entry.columns.join(', ')}`)
  }
}

main()
