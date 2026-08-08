// Gate: the scrubbed dev fixture's emitted-column projection is COMPLETE and
// actually redacts the secrets it claims to.
//
// The incident this exists to prevent: import-database-backup.mjs asserted a
// scrub over a column-name denylist, the first name in that list had been
// dropped from the schema, and every run aborted on 42703 -- so it scrubbed
// nothing for seven months while reading as the safe dev-restore path. Nothing
// noticed because nothing ever checked that the scrub could SEE its targets.
//
// So every check here ships with a NEGATIVE CONTROL that is proven to go red in
// the same run. A green check whose oracle is blind is the failure mode, and a
// control is the only thing that separates "no secrets present" from "cannot
// see any secrets".
//
// Two layers, deliberately pulling in opposite directions:
//
//   CEILING (fail-closed completeness) -- every column in the committed schema
//   must carry a disposition in the projection spec. This is what makes a NEW
//   secret-bearing column abort the derivation instead of riding along.
//
//   FLOOR (required scrubs) -- a named set of columns, plus a name heuristic,
//   that must NOT be "keep". A denylist is the wrong mechanism for the SCRUB,
//   which is why the projection is an allowlist; but it is the right mechanism
//   for an ASSERTION, because it fails when someone relaxes a disposition that
//   was deliberately tightened.

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  read_dumped_tables,
  read_projection,
  find_projection_gaps,
  build_projection_select
} from '../../scripts/derive-dev-fixture.mjs'

const gate_dir = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(gate_dir, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')

// Columns that must never be emitted verbatim. Every entry is a live secret or
// a financial value that has no business on a dev disk. Adding a column here is
// cheap; removing one needs a reason in the commit message.
const required_scrubs = [
  ['users', 'email'],
  ['users', 'password'],
  ['users', 'invite_code'],
  ['invite_codes', 'code'],
  ['leagues', 'discord_webhook_url'],
  ['leagues', 'espn_league_id'],
  ['leagues', 'sleeper_league_id'],
  ['leagues', 'mfl_league_id'],
  ['leagues', 'fleaflicker_league_id'],
  ['placed_wagers', 'book_wager_id'],
  ['placed_wagers', 'bet_wager_amount'],
  ['placed_wagers', 'total_wager_amount'],
  ['placed_wagers', 'wager_returned_amount'],
  // The widest exposure of all and the one absent from the original finding:
  // config.config_value carries third-party vendor credentials (a vendor
  // account email/password pair, OAuth client secrets and refresh tokens, an
  // api_key, session cookies, proxy credentials and an alerts webhook).
  ['config', 'config_value']
]

// A future column nobody remembers to list above. Matched against the column
// NAME only, so it costs nothing and catches the common shapes.
const secret_name_pattern =
  /(password|passwd|secret|token|api_?key|webhook|cookie|credential|private_key|access_key|auth)/i

/**
 * Parse column names per table out of the committed schema. CI has no
 * production database, and the committed schema is the artifact the suite and
 * the ratchet already treat as authoritative.
 */
export const read_schema_columns = async ({
  schema_file = schema_path
} = {}) => {
  const source = await fs.readFile(schema_file, 'utf8')
  const columns = {}
  const table_re = /CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/g
  let match
  while ((match = table_re.exec(source)) !== null) {
    const [, table, body] = match
    columns[table] = body
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(Boolean)
      .filter(
        (line) =>
          !/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(line)
      )
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean)
  }
  return columns
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const run = async () => {
  const failures = []
  const controls = []

  const projection = await read_projection()
  const dumped_tables = await read_dumped_tables()
  const schema_columns = await read_schema_columns()

  // Tables named for the dump that the schema does not define are reported by
  // find_projection_gaps; restrict the live map to what the schema knows so the
  // gate's inventory and the deriver's agree on shape.
  const live_columns = {}
  for (const table of dumped_tables) {
    if (schema_columns[table]) live_columns[table] = schema_columns[table]
  }

  // ---- CEILING: completeness --------------------------------------------
  const gaps = find_projection_gaps({
    projection,
    live_columns,
    dumped_tables
  })
  for (const gap of gaps) {
    failures.push(`completeness: ${gap}`)
  }

  // Control: remove one adjudicated column and confirm the completeness check
  // reports it. If this stays green the check cannot see columns at all.
  const control_projection = clone(projection)
  delete control_projection.users.email
  const control_gaps = find_projection_gaps({
    projection: control_projection,
    live_columns,
    dumped_tables
  })
  const control_saw_it = control_gaps.some((g) => g.includes('users.email'))
  controls.push(['completeness detects an unspecced column', control_saw_it])

  // ---- FLOOR: required scrubs -------------------------------------------
  const check_required = (spec) => {
    const missed = []
    for (const [table, column] of required_scrubs) {
      const disposition = spec[table] && spec[table][column]
      if (disposition === undefined) {
        missed.push(`${table}.${column} is not in the projection spec at all`)
      } else if (disposition === 'keep') {
        missed.push(`${table}.${column} is emitted verbatim ("keep")`)
      }
    }
    return missed
  }
  for (const problem of check_required(projection)) {
    failures.push(`required scrub: ${problem}`)
  }

  // Control: relax one required scrub and confirm the check goes red.
  const relaxed = clone(projection)
  relaxed.users.password = 'keep'
  controls.push([
    'required-scrub check detects a relaxed disposition',
    check_required(relaxed).some((m) => m.includes('users.password'))
  ])

  // ---- FLOOR: name heuristic --------------------------------------------
  const check_heuristic = (spec) => {
    const missed = []
    for (const [table, columns] of Object.entries(spec)) {
      for (const [column, disposition] of Object.entries(columns)) {
        if (disposition === 'keep' && secret_name_pattern.test(column)) {
          missed.push(`${table}.${column} looks secret-bearing but is "keep"`)
        }
      }
    }
    return missed
  }
  for (const problem of check_heuristic(projection)) {
    failures.push(`name heuristic: ${problem}`)
  }

  const heuristic_control = clone(projection)
  heuristic_control.users.synthetic_api_key_column = 'keep'
  controls.push([
    'name heuristic detects a secret-shaped column',
    check_heuristic(heuristic_control).some((m) =>
      m.includes('synthetic_api_key_column')
    )
  ])

  // ---- The emitted SQL actually drops the raw column ---------------------
  // The checks above read the SPEC. This one reads what the deriver BUILDS, so
  // a spec that is correct but a builder that ignores it cannot pass.
  const check_emitted_sql = (spec) => {
    const missed = []
    for (const [table, column] of required_scrubs) {
      if (!spec[table]) continue
      const sql = build_projection_select({ table, columns: spec[table] })
      // A scrubbed column must appear only as the alias target, never as a bare
      // selected column.
      if (sql.includes(`"${column}", `) || sql.endsWith(`"${column}"`)) {
        const aliased = sql.includes(`AS "${column}"`)
        if (!aliased) missed.push(`${table}.${column} is selected raw`)
      }
    }
    return missed
  }
  for (const problem of check_emitted_sql(projection)) {
    failures.push(`emitted SQL: ${problem}`)
  }

  const sql_control = clone(projection)
  sql_control.leagues.discord_webhook_url = 'keep'
  controls.push([
    'emitted-SQL check detects a raw-selected secret',
    check_emitted_sql(sql_control).some((m) =>
      m.includes('leagues.discord_webhook_url')
    )
  ])

  // ---- Report ------------------------------------------------------------
  const total_columns = Object.values(projection).reduce(
    (sum, cols) => sum + Object.keys(cols).length,
    0
  )
  const scrubbed_columns = Object.values(projection).reduce(
    (sum, cols) => sum + Object.values(cols).filter((d) => d !== 'keep').length,
    0
  )

  console.log(
    `dev fixture scrub -- ${Object.keys(projection).length} tables, ` +
      `${total_columns} columns adjudicated, ${scrubbed_columns} scrubbed`
  )

  let control_failed = false
  for (const [name, passed] of controls) {
    console.log(
      `  control ${passed ? 'RED (good)' : 'STAYED GREEN (bad)'}: ${name}`
    )
    if (!passed) control_failed = true
  }

  if (control_failed) {
    console.error(
      '\nA negative control did not fire. The checks above prove nothing -- ' +
        'a scrub asserted green over a column its oracle cannot see is the ' +
        'original incident repeating.'
    )
    process.exit(2)
  }

  if (failures.length) {
    console.error(`\n${failures.length} finding(s):`)
    for (const failure of failures) console.error(`  ${failure}`)
    process.exit(1)
  }

  console.log(
    '  OK -- projection is complete and every required scrub is in force'
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(2)
})
