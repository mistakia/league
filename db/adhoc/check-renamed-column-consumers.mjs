// Consumer gate for renamed and dropped columns -- the two defect classes that
// the 2026-08-05 restricted-free-agency incident exposed, neither of which any
// existing gate can see.
//
//   CLASS 1  server reads a DB column by a name the schema no longer carries.
//            Postgres raises 42703, but only when that code path executes, so a
//            green suite and a green deploy both report success.
//
//   CLASS 2  server reads the RIGHT column and EMITS it under the OLD API key
//            (or the SPA still reads the old key). The value is correct
//            server-side and lost at the client boundary, so a server-side grep
//            for the old column name finds nothing -- the SOURCE was renamed and
//            only the DESTINATION key is stale. This is the class that rendered
//            every manager's RFA bid as $0 for ~13 hours while every server
//            oracle stayed green.
//
// WHY THE TWO GATES ARE SHAPED DIFFERENTLY. Class 1 needs no rename list: a
// qualified `'<table>.<column>'` literal either resolves against the current
// schema or it does not, so the schema alone is a complete oracle. That matters
// because the rename record is NOT complete -- several clusters were run as
// expand-contract (ADD/backfill/DROP, zero RENAME statements), so any gate
// deriving old names by grepping `db/adhoc` for RENAME is structurally blind to
// them. Class 2 has no such self-check: an emitted object key is just a key, and
// nothing but the rename itself says it is stale. So gate 2 works off the schema
// DIFF against a base ref, which makes it incremental -- it asks "did THIS change
// remove a column whose old name is still read somewhere", which is exactly the
// question CI is positioned to answer.
//
// Usage:
//   node db/adhoc/check-renamed-column-consumers.mjs                  # both gates
//   node db/adhoc/check-renamed-column-consumers.mjs --base <ref>     # gate 2 base
//   node db/adhoc/check-renamed-column-consumers.mjs --gate 1         # one gate
//   node db/adhoc/check-renamed-column-consumers.mjs --json
//
// Exit code is non-zero when either gate finds a consumer (gate-friendly).
//
// BLIND SPOTS -- this is a FLOOR, not a proof.
//   - Gate 1 only sees TABLE-QUALIFIED string literals. A bare `.select('pos')`
//     or an object-shorthand `.where({ pos })` names no table and cannot be
//     resolved without type inference; those stay invisible.
//   - Gate 1 skips a prefix that is not a real table name, so a CTE or subquery
//     alias is correctly ignored -- but a CTE deliberately NAMED after a table
//     while projecting different columns would be a false positive. None exist
//     today; add it to CTE_ALIAS_ALLOWLIST if one appears.
//   - Gate 2 cannot see a key renamed WITHOUT a schema change (a pure API-shape
//     rename), and it reads bare identifiers, so a short or English-word column
//     name is filtered as unusable rather than reported.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')

const SERVER_ROOTS = ['api', 'libs-server', 'libs-shared', 'scripts', 'jobs']
const SPA_ROOTS = ['app']

// A CTE or subquery alias that shadows a real table name would produce a false
// positive in gate 1. `.as('<name>')` aliases are detected per-file instead (see
// collect_local_aliases); this set is for a shadow the scan cannot infer.
const CTE_ALIAS_ALLOWLIST = new Set([])

// `'rosters.csv'` and `'transactions.json'` parse as table-qualified columns
// because the stem is a real table name. A file extension is never a column.
const FILE_EXTENSION_SUFFIXES = new Set([
  'csv',
  'json',
  'js',
  'mjs',
  'md',
  'sql',
  'txt',
  'yml',
  'yaml',
  'html',
  'css'
])

// Gate 2 reads bare identifiers out of the SPA, so a column name that is also an
// ordinary English word or a ubiquitous short token cannot be matched usefully --
// it would report on every unrelated local variable. Filtering these UNDER-reports
// (a real stale key is missed and a human must catch it), which is the safe
// direction: it cannot manufacture a spurious finding.
const UNUSABLE_AS_BARE_IDENTIFIER = new Set([
  'active',
  'app',
  'avg',
  'back',
  'bench',
  'blitz',
  'box',
  'cap',
  'charted',
  'clock',
  'comp',
  'deleted',
  'desc',
  'div',
  'drops',
  'games',
  'grade',
  'hits',
  'hosted',
  'int',
  'live',
  'losses',
  'max',
  'min',
  'motion',
  'new',
  'off',
  'open',
  'opp',
  'order',
  'pass',
  'penalty',
  'played',
  'plays',
  'pos',
  'position',
  'pressure',
  'prev',
  'prop',
  'rank',
  'rec',
  'removed',
  'risk',
  'route',
  'run',
  'rush',
  'safety',
  'score',
  'snaps',
  'special',
  'speed',
  'start',
  'started',
  'std',
  'success',
  'team',
  'temp',
  'ties',
  'timeout',
  'timeouts',
  'timestamp',
  'to',
  'total',
  'touchback',
  'touchdown',
  'valid',
  'value',
  'wind',
  'wins',
  'year'
])

const parse_schema = (sql) => {
  const tables = new Map()
  const create_re =
    /CREATE TABLE (?:public\.)?"?([a-z_0-9]+)"?\s*\(([\s\S]*?)\n\);/g
  let match
  while ((match = create_re.exec(sql)) !== null) {
    const [, table_name, body] = match
    const columns = new Set()
    for (const raw_line of body.split('\n')) {
      const line = raw_line.trim()
      if (
        !line ||
        line.startsWith('CONSTRAINT') ||
        line.startsWith('PRIMARY')
      ) {
        continue
      }
      const column_match = line.match(/^"?([a-z_0-9]+)"?\s+/i)
      if (column_match) columns.add(column_match[1])
    }
    tables.set(table_name, columns)
  }
  return tables
}

const walk_files = (roots, extensions) => {
  const files = []
  const visit = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const full_path = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full_path)
      else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(full_path)
      }
    }
  }
  for (const root of roots) visit(path.join(repo_root, root))
  return files
}

const is_comment = (line) => {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*')
}

// A subquery aliased as a real table name (`.as('transactions')`) legitimately
// projects columns the physical table does not have. Collect those per-file so
// the shadow suppresses findings only where it is actually declared.
const collect_local_aliases = (source) => {
  const aliases = new Set()
  const alias_re = /\.as\(\s*['"`]([a-z_][a-z_0-9]*)['"`]\s*\)/g
  let match
  while ((match = alias_re.exec(source)) !== null) aliases.add(match[1])
  return aliases
}

// GATE 1 -- every table-qualified column literal must resolve against the schema.
const run_gate_1 = (tables) => {
  const findings = []
  const qualified_re = /['"`]([a-z_][a-z_0-9]*)\.([a-z_][a-z_0-9]*)['"`]/g
  for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
    const source = fs.readFileSync(file, 'utf8')
    const local_aliases = collect_local_aliases(source)
    const lines = source.split('\n')
    lines.forEach((line, index) => {
      if (is_comment(line)) return
      let match
      qualified_re.lastIndex = 0
      while ((match = qualified_re.exec(line)) !== null) {
        const [, table_name, column_name] = match
        if (!tables.has(table_name)) continue
        if (CTE_ALIAS_ALLOWLIST.has(table_name)) continue
        if (local_aliases.has(table_name)) continue
        if (FILE_EXTENSION_SUFFIXES.has(column_name)) continue
        if (tables.get(table_name).has(column_name)) continue
        findings.push({
          gate: 1,
          table: table_name,
          column: column_name,
          file: path.relative(repo_root, file),
          line: index + 1,
          text: line.trim().slice(0, 140)
        })
      }
    })
  }
  return findings
}

const schema_at_ref = (ref) => {
  try {
    return execFileSync('git', ['show', `${ref}:db/schema.postgres.sql`], {
      cwd: repo_root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024
    })
  } catch {
    return null
  }
}

// GATE 2 -- a column removed since `base` must not still be read by the SPA or
// emitted as an object key by the server.
const run_gate_2 = ({ tables, base_ref }) => {
  const base_sql = schema_at_ref(base_ref)
  if (base_sql === null) {
    return {
      findings: [],
      skipped: `could not read db/schema.postgres.sql at ${base_ref}`
    }
  }
  const base_tables = parse_schema(base_sql)

  const removed = []
  for (const [table_name, base_columns] of base_tables) {
    const current_columns = tables.get(table_name)
    if (!current_columns) continue // table dropped or renamed -- out of scope here
    for (const column of base_columns) {
      if (!current_columns.has(column))
        removed.push({ table: table_name, column })
    }
  }
  if (!removed.length) return { findings: [], removed_count: 0 }

  // A partitioned table repeats every column across its children, which would
  // list 30 table names for one finding. Report the parent only.
  const is_partition_child = (name) =>
    /_year_\d{4}$/.test(name) ||
    /_y\d{4}$/.test(name) ||
    name.endsWith('_default')

  const candidates = new Map()
  for (const { table, column } of removed) {
    if (UNUSABLE_AS_BARE_IDENTIFIER.has(column)) continue
    if (column.length < 3) continue
    if (is_partition_child(table)) continue
    if (!candidates.has(column)) candidates.set(column, [])
    candidates.get(column).push(table)
  }
  if (!candidates.size) return { findings: [], removed_count: removed.length }

  const findings = []
  const scan = (roots, surface) => {
    for (const file of walk_files(roots, ['.mjs', '.js'])) {
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (is_comment(line)) return
        for (const [column, owning_tables] of candidates) {
          // Read positions that matter: Immutable get/getIn, a quoted key, or an
          // object-literal key -- the three shapes a stale API key actually takes.
          const read_re = new RegExp(
            `\\.get\\(['"\`]${column}['"\`]|['"\`]${column}['"\`]\\s*[,\\]\\)]|(?:^|[\\s{(,])${column}\\s*:`
          )
          if (!read_re.test(line)) continue
          findings.push({
            gate: 2,
            surface,
            column,
            tables: owning_tables,
            file: path.relative(repo_root, file),
            line: index + 1,
            text: line.trim().slice(0, 140)
          })
        }
      })
    }
  }
  scan(SPA_ROOTS, 'spa')
  scan(SERVER_ROOTS, 'server')
  return { findings, removed_count: removed.length }
}

const main = () => {
  const argv = yargs(hideBin(process.argv))
    .option('base', {
      type: 'string',
      default: 'origin/master',
      describe: 'git ref to diff the schema against for gate 2'
    })
    .option('gate', { type: 'number', describe: 'run only gate 1 or gate 2' })
    .option('json', { type: 'boolean', default: false })
    .parse()

  if (!fs.existsSync(schema_path)) {
    console.error(`missing schema file: ${schema_path}`)
    process.exit(2)
  }
  const tables = parse_schema(fs.readFileSync(schema_path, 'utf8'))

  const gate_1_findings = argv.gate === 2 ? [] : run_gate_1(tables)
  const gate_2 =
    argv.gate === 1
      ? { findings: [], removed_count: 0 }
      : run_gate_2({ tables, base_ref: argv.base })

  const all = [...gate_1_findings, ...gate_2.findings]

  if (argv.json) {
    console.log(
      JSON.stringify(
        { tables: tables.size, gate_1: gate_1_findings, gate_2 },
        null,
        2
      )
    )
  } else {
    console.log(`Parsed ${tables.size} tables from db/schema.postgres.sql\n`)

    console.log(`GATE 1 -- table-qualified columns that do not resolve`)
    if (!gate_1_findings.length) console.log('  none\n')
    for (const finding of gate_1_findings) {
      console.log(
        `  ${finding.table}.${finding.column}  ${finding.file}:${finding.line}`
      )
      console.log(`     ${finding.text}`)
    }

    console.log(`\nGATE 2 -- consumers of a column removed since ${argv.base}`)
    if (gate_2.skipped) {
      console.log(`  SKIPPED: ${gate_2.skipped}`)
    } else if (!gate_2.findings.length) {
      console.log(
        `  none (${gate_2.removed_count ?? 0} column(s) removed since base)\n`
      )
    } else {
      for (const finding of gate_2.findings) {
        console.log(
          `  [${finding.surface}] ${finding.column} (was on ${finding.tables.join(', ')})  ${finding.file}:${finding.line}`
        )
        console.log(`     ${finding.text}`)
      }
    }

    console.log(
      all.length
        ? `\nGATE FAIL: ${all.length} finding(s) -- repoint before shipping.`
        : `\nGATE OK.`
    )
  }

  process.exit(all.length ? 1 : 0)
}

main()
