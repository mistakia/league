// Schema conformance audit for the league four-layer redesign.
//
// Parses db/schema.postgres.sql (the source of truth) and flags every column
// and table identifier that violates user:guideline/league/database-schema-standards.md.
// It is the ratcheting oracle the per-cluster migration recipe cites in its
// "conformance-audit clean" verify step: run it whole to see the standing debt,
// or scoped to one table/cluster to prove that cluster conforms.
//
// No database connection -- it reads the exported schema file only, so it runs
// anywhere and is safe to wire into the pre-publish gate.
//
// Usage:
//   node db/adhoc/audit-schema-conformance.mjs                 # whole schema
//   node db/adhoc/audit-schema-conformance.mjs --table player  # one table
//   node db/adhoc/audit-schema-conformance.mjs --summary       # counts only
//   node db/adhoc/audit-schema-conformance.mjs --json          # machine output
//
// Exit code is non-zero when any violation is found (gate-friendly).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema_path = path.join(__dirname, '..', 'schema.postgres.sql')

// --- rule inputs (ratcheting: extend these lists as new debt is discovered) ---

// Canonical keys and identifiers that are deliberately retained (operator
// decision) and MUST NOT be flagged even though they are short.
const allowlisted_identifiers = new Set([
  'pid',
  'esbid',
  'lid', // league id -- app key
  'tid', // team id -- app key
  'uid' // user id -- app key
])

// Reserved words used as identifiers (must be quoted in SQL, which is the tell).
const reserved_word_columns = new Set([
  'desc',
  'int',
  'to',
  'order',
  'end',
  'default',
  'primary',
  'offset',
  'from',
  'select',
  'user',
  'check'
])

// Known fantasy-stat / role shorthand that must be spelled in full words.
// Value is the intended full-word replacement (for the report only).
const shorthand_columns = new Map([
  ['py', 'passing_yards'],
  ['ry', 'rushing_yards'],
  ['recy', 'receiving_yards'],
  ['pa', 'pass_attempts'],
  ['pc', 'pass_completions'],
  ['ra', 'rush_attempts'],
  ['rec', 'receptions'],
  ['trg', 'targets'],
  ['tdp', 'passing_touchdowns'],
  ['tdr', 'rushing_touchdowns'],
  ['tdrec', 'receiving_touchdowns'],
  ['fuml', 'fumbles_lost'],
  ['twoptc', 'two_point_conversions'],
  ['snp', 'snaps'],
  ['tm', 'nfl_team'],
  ['opp', 'opponent_nfl_team'],
  ['off', 'offense_nfl_team'],
  ['def', 'defense_nfl_team'],
  ['pos_team', 'team_nfl_team'],
  ['bc_pid', 'ball_carrier_pid'],
  ['psr_pid', 'passer_pid'],
  ['trg_pid', 'target_pid'],
  ['intp_pid', 'interceptor_pid']
])

// Bare single-letter / ambiguous team-role spellings (checked as exact names).
const ambiguous_team_columns = new Set(['v', 'h', 'team', 'club', 'clubcode'])

// Source-revealing vendor terms (the obfuscation legend is private; this list
// is only the publicly-obvious vendor tokens the audit flags in identifiers).
// Kept deliberately in-code and non-secret: these are the names being retired.
const vendor_tokens = [
  'pff',
  'dvoa',
  'espn',
  'ngs',
  'keeptradecut',
  'ktc',
  'sleeper',
  'sportradar',
  'fantasypros',
  'draftkings',
  'fanduel',
  'prizepicks',
  'underdog',
  'sis',
  'cfbref',
  'pfr'
]

// External-id columns that end in _id but do not follow {system}_{entitytype}_id.
// Detected by pattern; this set is the known non-conforming roster for messaging.
const known_bad_external_ids = new Set([
  'gsisid',
  'gsis_it_id',
  'esb_id',
  'pff_id',
  'sleeper_id',
  'espn_id',
  'sportradar_id',
  'yahoo_id',
  'rotoworld_id',
  'rotowire_id',
  'cbs_id',
  'cfbref_id',
  'sis_id',
  'pfr_id',
  'keeptradecut_id',
  'fantasypros_id'
])

// --- schema parsing ----------------------------------------------------------

// Extract { table -> [{ name, quoted, type }] } from CREATE TABLE blocks.
// Partition children (CREATE TABLE ... PARTITION OF ...) carry no column list
// and are skipped; their parent carries the columns.
function parse_schema(sql) {
  const tables = new Map()
  const lines = sql.split('\n')
  let current = null
  let columns = null

  const create_re = /^CREATE TABLE (?:public\.)?("?[A-Za-z0-9_]+"?)\s*\(\s*$/

  for (const raw of lines) {
    if (current === null) {
      const m = raw.match(create_re)
      if (m) {
        current = m[1].replace(/"/g, '')
        columns = []
      }
      continue
    }

    // End of the block.
    if (/^\);/.test(raw.trim()) || raw.trim() === ')') {
      tables.set(current, columns)
      current = null
      columns = null
      continue
    }

    const col = parse_column_line(raw)
    if (col) columns.push(col)
  }

  return tables
}

// A column line looks like: `    "playId" integer NOT NULL,`
// Skip table-level constraint lines.
function parse_column_line(raw) {
  const trimmed = raw.trim().replace(/,$/, '')
  if (!trimmed) return null

  const constraint_kw =
    /^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|EXCLUDE|PARTITION|LIKE)\b/i
  if (constraint_kw.test(trimmed)) return null

  const quoted = trimmed.match(/^"([^"]+)"\s+(.*)$/)
  if (quoted) {
    return { name: quoted[1], quoted: true, type: quoted[2] }
  }

  const bare = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$/)
  if (bare) {
    return { name: bare[1], quoted: false, type: bare[2] }
  }

  return null
}

// --- rule checks -------------------------------------------------------------

const RULES = {
  quoted_camelcase: 'Quoted/camelCase identifier (snake_case required)',
  reserved_word: 'Reserved word used as identifier',
  shorthand: 'Domain shorthand (full words required)',
  ambiguous_team: 'Ambiguous team-role spelling (qualify explicitly)',
  external_id: 'External-id column not following {system}_{entitytype}_id',
  timestamp_type: 'Non-timestamptz timestamp representation',
  vendor_leak: 'Source-revealing vendor token in identifier'
}

function looks_like_time_column(name) {
  return /(_at|_time|_ts|timestamp|_date)$/.test(name) || name === 'timestamp'
}

function check_column(table, col) {
  const findings = []
  const lower = col.name.toLowerCase()

  if (allowlisted_identifiers.has(lower)) {
    // canonical retained key -- only the vendor/time checks below still apply,
    // and none match an allowlisted key, so return clean.
    return findings
  }

  // Quoted / camelCase.
  if (col.quoted || /[A-Z]/.test(col.name)) {
    findings.push({ rule: 'quoted_camelcase', table, column: col.name })
  }

  // Reserved words (they are quoted in the dump, but flag by name too).
  if (reserved_word_columns.has(lower)) {
    findings.push({ rule: 'reserved_word', table, column: col.name })
  }

  // Shorthand.
  if (shorthand_columns.has(lower)) {
    findings.push({
      rule: 'shorthand',
      table,
      column: col.name,
      hint: shorthand_columns.get(lower)
    })
  }

  // Ambiguous team-role bare names.
  if (ambiguous_team_columns.has(lower)) {
    findings.push({ rule: 'ambiguous_team', table, column: col.name })
  }

  // External id naming: ends in _id (or is a known id) but is not {a}_{b}_id.
  const is_id_column =
    /_?id$/.test(lower) && !allowlisted_identifiers.has(lower)
  const conforms_external =
    /^[a-z0-9]+_[a-z0-9]+_id$/.test(lower) || /_pid$/.test(lower)
  if (
    (known_bad_external_ids.has(lower) ||
      (is_id_column && !conforms_external && looks_like_external(lower))) &&
    !conforms_external
  ) {
    findings.push({ rule: 'external_id', table, column: col.name })
  }

  // Timestamp representation.
  const type = col.type.toLowerCase()
  if (looks_like_time_column(lower)) {
    const is_tztimestamp = /timestamp with time zone|timestamptz/.test(type)
    const is_epoch_int = /^(integer|bigint|numeric)/.test(type)
    const is_varchar = /character varying|text/.test(type)
    const is_plain_timestamp =
      /timestamp without time zone/.test(type) ||
      (/^timestamp\b/.test(type) && !is_tztimestamp)
    if (is_epoch_int || is_varchar || is_plain_timestamp) {
      findings.push({
        rule: 'timestamp_type',
        table,
        column: col.name,
        detail: col.type.trim()
      })
    }
  }

  // Vendor leak in a column name.
  const vendor = vendor_tokens.find((t) => name_has_token(lower, t))
  if (vendor) {
    findings.push({
      rule: 'vendor_leak',
      table,
      column: col.name,
      token: vendor
    })
  }

  return findings
}

// Heuristic: an id column referencing an external system (has a vendor token or
// a system-ish prefix) rather than an internal app key.
function looks_like_external(name) {
  if (vendor_tokens.some((t) => name_has_token(name, t))) return true
  return /^(gsis|sleeper|yahoo|roto|cbs|shield|nfl)_?/.test(name)
}

// Token appears as a word-boundary segment in a snake/qualified name, so `pff`
// matches pff_id / nfl_pff / x_pff_y but not e.g. `spffx` accidental substrings.
function name_has_token(name, token) {
  return new RegExp(`(^|_)${token}(_|$)`).test(name)
}

function check_table_name(table) {
  const findings = []
  const lower = table.toLowerCase()
  if (/[A-Z]/.test(table)) {
    findings.push({ rule: 'quoted_camelcase', table, column: null })
  }
  const vendor = vendor_tokens.find((t) => name_has_token(lower, t))
  if (vendor) {
    findings.push({ rule: 'vendor_leak', table, column: null, token: vendor })
  }
  return findings
}

// --- runner ------------------------------------------------------------------

// pg_dump emits every year-range partition child with a full duplicate column
// list. Auditing each child would count the same violation ~27x and drown the
// report in per-partition noise, so a `<base>_year_YYYY` child is skipped when
// its base parent is present -- the parent carries the columns and is audited
// once.
function is_partition_child(table, tables) {
  const m = table.match(/^(.+)_year_\d{4}$/)
  return m ? tables.has(m[1]) : false
}

function audit(tables, filter) {
  const all = []
  for (const [table, columns] of tables) {
    if (filter && table !== filter) continue
    if (!filter && is_partition_child(table, tables)) continue
    all.push(...check_table_name(table))
    for (const col of columns) {
      all.push(...check_column(table, col))
    }
  }
  return all
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('table', { type: 'string', description: 'Audit one table only' })
    .option('summary', { type: 'boolean', default: false })
    .option('json', { type: 'boolean', default: false })
    .help().argv

  const sql = fs.readFileSync(schema_path, 'utf8')
  const tables = parse_schema(sql)
  const findings = audit(tables, argv.table)

  // Set exitCode rather than calling process.exit(): a large JSON payload is
  // still buffering when process.exit() would fire, and the abrupt exit
  // truncates stdout mid-write. exitCode lets the write drain naturally.
  if (argv.json) {
    console.log(JSON.stringify({ tables: tables.size, findings }, null, 2))
    process.exitCode = findings.length ? 1 : 0
    return
  }

  const by_rule = new Map()
  for (const f of findings) {
    by_rule.set(f.rule, (by_rule.get(f.rule) || 0) + 1)
  }

  console.log(
    `schema conformance audit -- ${tables.size} tables parsed${argv.table ? ` (filtered to ${argv.table})` : ''}`
  )
  console.log(`total violations: ${findings.length}`)
  console.log('')
  for (const rule of Object.keys(RULES)) {
    console.log(
      `  ${String(by_rule.get(rule) || 0).padStart(5)}  ${rule} -- ${RULES[rule]}`
    )
  }

  if (!argv.summary && findings.length) {
    console.log('\n--- detail ---')
    for (const f of findings) {
      const loc = f.column ? `${f.table}.${f.column}` : `${f.table} (table)`
      const extra = f.hint
        ? ` -> ${f.hint}`
        : f.detail
          ? ` [${f.detail}]`
          : f.token
            ? ` [${f.token}]`
            : ''
      console.log(`  [${f.rule}] ${loc}${extra}`)
    }
  }

  process.exitCode = findings.length ? 1 : 0
}

main()
