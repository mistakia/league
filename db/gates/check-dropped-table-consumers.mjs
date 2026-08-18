// Dropped-table consumer check for the league schema redesign.
//
// Proves the one invariant the redesign's bookkeeping still needs a machine for:
// a table the redesign DROPPED must have no consumer left behind. Each dropped
// name is grepped across the code tree and a surviving reference is an error.
//
// The dropped list is an explicit constant below rather than a derived set, and
// that is deliberate. It cannot be derived from the migration inventory: the
// inventory is REGENERATED from db/schema.postgres.sql, so by construction every
// name in it still exists in the schema and `inventory - schema` is always
// empty. The retired progress trackers happened to preserve dropped names only
// as a side effect of never being regenerated -- an accident of staleness, not a
// design. Recording the list here makes it durable repo state, and adds one
// deliberate line to the cost of dropping a table.
//
// Scoped to dropped tables on purpose: the redesign renames COLUMNS, not tables,
// so an inventory name that still exists in the schema is a live table whose
// consumers are supposed to name it. Grepping every table's name only measures
// how common the word is -- `teams` matched 293 files and none of them were
// debt. Column-level residue is covered by db/tools/audit-schema-conformance.mjs
// and the repoint detectors.
//
// This replaces the former check-migration-coverage.mjs, which also aggregated
// per-cluster progress trackers in scratch and gated completion on
// --require-done. That tracker substrate was retired on 2026-07-29: it stopped
// being maintained around the thirteenth cluster and drifted to reporting 167
// todo / 17 done while most of the work had in fact landed, so it was a second
// oracle that had been wrong for two weeks. audit-schema-conformance.mjs is now
// the sole completion gate, with the task plan checkboxes carrying the scope the
// audit cannot see.
//
// Usage:
//   node db/gates/check-dropped-table-consumers.mjs
//
// Exit non-zero if any dropped table still has a consumer.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// Tables dropped over the course of the schema redesign. Append here in the
// same commit that drops a table. Every entry is asserted absent from
// db/schema.postgres.sql below, so a name that is later re-created fails loudly
// rather than silently checking nothing.
const DROPPED_TABLES = [
  'external_league_import_job_history',
  'footballoutsiders',
  'keeptradecut_rankings',
  'personnel_count_discrepancies',
  'pff_game_id_map',
  'player_changelog_injury_status_snapshot_2026_05_23',
  'player_gamelogs_active_snapshot_2026_05_23',
  'prop_markets',
  'props_index_new',
  'schedule',
  'worker_heartbeat'
]

// Match the SYNTAX of a table reference rather than the bare word.
//
// A bare `\btable\b` grep only works while every dropped name is a distinctive
// coinage, which is an accident of the names dropped so far. `schedule` broke
// it: the word appears in 76 files -- fantasy schedule generation, cron
// "schedule", route and variable names -- and not one of them referenced the
// dropped SQL table. A gate that reports 76 non-defects is one readers learn to
// discount, which is the failure operation-log 004 records for the vendor_leak
// rule.
//
// These patterns cover how a table is actually named in this codebase: as a
// knex builder argument, as an argument to knex's from/into/join family, or as
// the object of a SQL keyword in raw text. Aliases (`schedule as s`) and an
// explicit `public.` qualifier are both allowed for.
function table_reference_patterns(table) {
  const t = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const quoted = `['"\`]${t}(?:\\s+as\\s+\\w+)?['"\`]`
  const joins =
    'from|into|table|join|leftJoin|rightJoin|innerJoin|outerJoin|' +
    'fullOuterJoin|leftOuterJoin|rightOuterJoin|crossJoin|joinRaw'
  return [
    // db('schedule'), trx("schedule as s")
    new RegExp(`\\b(?:db|trx|knex)\\s*\\(\\s*${quoted}`),
    // .from('schedule'), .leftJoin('schedule as s', ...)
    new RegExp(`\\.(?:${joins})\\s*\\(\\s*${quoted}`),
    // raw SQL: FROM schedule, JOIN public.schedule, INSERT INTO schedule, ...
    // SQL keywords are case-insensitive; the two builder patterns above are not,
    // because their `joins` alternation is camelCase and folding case there would
    // match spellings knex does not have.
    new RegExp(
      `\\b(?:from|join|into|update|table)\\s+(?:public\\.)?${t}\\b`,
      'i'
    )
  ]
}

// Walk every file under the scanned directories, with no extension filter.
//
// The filter is deliberately absent rather than forgotten. This gate previously
// shelled out to ripgrep, which searches every file type, so restricting to
// .mjs/.js here would silently narrow the gate's reach -- a raw table reference
// in a .sql, .cron or .json file would stop being seen while the run still
// printed `ok`. `dist` and `node_modules` are skipped for the same reason
// ripgrep skipped them: they are build output, not consumers.
function walk_all_files(dir) {
  const files = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    if (entry.name === '.git') continue
    const full_path = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk_all_files(full_path))
    else if (entry.isFile()) files.push(full_path)
  }
  return files
}

const SCAN_DIRS = [
  'libs-server',
  'libs-shared',
  'app',
  'server',
  'api',
  'jobs',
  'scripts'
]

// Read the scanned tree once. Every dropped table is matched against the same
// corpus, so reading per table would re-read several thousand files per run.
//
// A file holding a NUL byte is skipped, matching ripgrep's binary handling: it
// is not source, and a NUL makes the content untrustworthy to match against.
function load_corpus() {
  const dirs = SCAN_DIRS.filter((d) => fs.existsSync(path.join(repo_root, d)))
  const corpus = []
  for (const dir of dirs) {
    for (const file of walk_all_files(path.join(repo_root, dir))) {
      let text
      try {
        text = fs.readFileSync(file, 'utf8')
      } catch {
        continue
      }
      if (text.includes('\x00')) continue
      corpus.push({ relative_path: path.relative(repo_root, file), text })
    }
  }
  return corpus
}

function find_consumer_files(table, corpus) {
  const patterns = table_reference_patterns(table)
  const files = []
  for (const entry of corpus) {
    if (patterns.some((pattern) => pattern.test(entry.text)))
      files.push(entry.relative_path)
  }
  return files.sort()
}

// Tables the exported schema still defines, used to assert DROPPED_TABLES has
// not gone stale.
function load_schema_tables() {
  const file = path.join(repo_root, 'db', 'schema.postgres.sql')
  const text = fs.readFileSync(file, 'utf8')
  const tables = new Set()
  for (const m of text.matchAll(/^CREATE TABLE public\.(\w+) \(/gm)) {
    tables.add(m[1])
  }
  return tables
}

// ---------------------------------------------------------------------------
// negative controls
// ---------------------------------------------------------------------------

// Five controls, run on EVERY invocation, and a control that does not hold
// fails the gate.
//
// This gate reports a green over eleven names on almost every run, which is the
// shape a broken matcher is invisible in: `no dropped table has a surviving
// consumer` is byte-identical whether the patterns work or match nothing at
// all. The matcher was rewritten off ripgrep onto the Node tree-walk above on
// 2026-08-18 (`6660fec37`) to take an environment dependency out of CI, so the
// thing producing that green is new code that had never been shown to go red.
//
// THREE RED, one per pattern shape, because the three shapes fail
// independently: the two builder patterns are case-SENSITIVE by design and the
// raw-SQL one is not, so a single control would leave two shapes unproven.
//
// TWO SILENT, because suppressing noise is half of what these patterns are for.
// A bare-word matcher on `schedule` hit 76 files and not one was a defect;
// the patterns exist to reject those, and a matcher that went back to matching
// bare words would fail in the direction that looks like MORE coverage.
//
// Every control mutates REAL corpus material -- it must FIND an occurrence of
// its shape before it can rewrite one -- so an emptied or unreachable corpus
// reports NO MATERIAL and fails, rather than passing over nothing.
const CONTROL_TABLE = 'schedule'

// Rewrite one occurrence IN PLACE by offset, never by pattern. An ordinary
// table name recurs across a file, and a pattern rewrite would plant matches at
// sites the control is not aiming at -- which turns a silent control green for
// a reason that has nothing to do with the shape under test.
const rewrite_at = ({ text, offset, length, replacement }) =>
  text.slice(0, offset) + replacement + text.slice(offset + length)

// The first corpus entry carrying an occurrence of the shape `find` names, in
// a file that does not ALREADY match the control table -- a file that matched
// beforehand would make a silent control pass on the gate's own prior finding.
const pick_material = ({ corpus, find }) => {
  const control_patterns = table_reference_patterns(CONTROL_TABLE)
  for (const entry of corpus) {
    if (control_patterns.some((pattern) => pattern.test(entry.text))) continue
    const hit = find(entry.text)
    if (hit) return { entry, hit }
  }
  return null
}

// A quoted table-name argument to a call: `db('players')`, `.leftJoin("x as y")`.
// Returns the offset and length of the NAME inside the quotes.
const find_quoted_argument = (text, callee_pattern) => {
  const re = new RegExp(
    `${callee_pattern}\\s*\\(\\s*['"\`]([a-z_][a-z_0-9]*)['"\`]`,
    'g'
  )
  const match = re.exec(text)
  if (!match) return null
  const name = match[1]
  return {
    offset: match.index + match[0].lastIndexOf(name),
    length: name.length
  }
}

const CONTROLS = [
  {
    name: 'a knex builder argument naming a dropped table is reported',
    direction: 'must-report',
    find: (text) => find_quoted_argument(text, '\\b(?:db|trx|knex)')
  },
  {
    name: 'a join-family argument naming a dropped table is reported',
    direction: 'must-report',
    find: (text) =>
      find_quoted_argument(
        text,
        '\\.(?:from|into|table|join|leftJoin|rightJoin|innerJoin)'
      )
  },
  {
    // Deliberately anchored on an UPPERCASE keyword. The raw-SQL pattern is the
    // only case-insensitive one of the three, and matching it against a
    // lowercase keyword would leave the `i` flag -- the thing that makes it
    // differ from the other two -- untested.
    name: 'a raw SQL keyword naming a dropped table is reported, case-insensitively',
    direction: 'must-report',
    find: (text) => {
      const re = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-z_][a-z_0-9]*)\b/g
      const match = re.exec(text)
      if (!match) return null
      const name = match[1]
      return {
        offset: match.index + match[0].lastIndexOf(name),
        length: name.length
      }
    }
  },
  {
    // The 76-file case, from the header. `schedule` as an ordinary local is not
    // a table reference and must not be reported.
    name: 'a bare-word occurrence that is NOT a table reference stays silent',
    direction: 'must-stay-silent',
    find: (text) => {
      const re = /\bconst\s+([a-z_][a-z_0-9]*)\s*=/g
      const match = re.exec(text)
      if (!match) return null
      const name = match[1]
      return {
        offset: match.index + match[0].lastIndexOf(name),
        length: name.length
      }
    }
  },
  {
    // A quoted occurrence that is not a CALL argument. Quoting alone is not
    // what makes a name a table reference, and a matcher that dropped the
    // callee requirement would report every string that spells one.
    name: 'a quoted occurrence outside a builder call stays silent',
    direction: 'must-stay-silent',
    find: (text) => {
      const re = /(?:===|:)\s*['"`]([a-z_][a-z_0-9]*)['"`]/g
      const match = re.exec(text)
      if (!match) return null
      const name = match[1]
      return {
        offset: match.index + match[0].lastIndexOf(name),
        length: name.length
      }
    }
  }
]

function run_negative_controls(corpus) {
  return CONTROLS.map((control) => {
    const material = pick_material({ corpus, find: control.find })
    if (!material) {
      return {
        name: control.name,
        result: 'NO MATERIAL',
        detail:
          'no corpus occurrence of this shape -- the scan may not be reaching the tree',
        passed: false
      }
    }

    const { entry, hit } = material
    const mutated_text = rewrite_at({
      text: entry.text,
      offset: hit.offset,
      length: hit.length,
      replacement: CONTROL_TABLE
    })
    if (mutated_text === entry.text) {
      return {
        name: control.name,
        result: 'MUTATION DID NOT APPLY',
        detail: `${entry.relative_path} unchanged -- the control proved nothing`,
        passed: false
      }
    }

    const mutated_corpus = corpus.map((candidate) =>
      candidate === entry
        ? { relative_path: entry.relative_path, text: mutated_text }
        : candidate
    )
    const reported = find_consumer_files(
      CONTROL_TABLE,
      mutated_corpus
    ).includes(entry.relative_path)
    const passed = control.direction === 'must-report' ? reported : !reported
    return {
      name: control.name,
      result: passed
        ? control.direction === 'must-report'
          ? 'WENT RED'
          : 'STAYED SILENT'
        : control.direction === 'must-report'
          ? 'STAYED GREEN'
          : 'FALSE POSITIVE',
      detail: entry.relative_path,
      passed
    }
  })
}

function main() {
  const schema_tables = load_schema_tables()
  const dropped = [...DROPPED_TABLES].sort()

  console.log(
    `dropped-table consumer check -- ${dropped.length} dropped tables`
  )

  const errors = []
  // A dropped name that the schema defines again is a stale list, not a pass.
  for (const table of dropped) {
    if (schema_tables.has(table)) {
      errors.push(
        `${table} is listed as dropped but db/schema.postgres.sql defines it -- update DROPPED_TABLES`
      )
    }
  }

  const corpus = load_corpus()
  console.log(`  scanned ${corpus.length} files under ${SCAN_DIRS.join(', ')}`)

  for (const table of dropped) {
    const files = find_consumer_files(table, corpus)
    if (files.length) {
      errors.push(
        `dropped table ${table} still has ${files.length} consumer file(s):\n` +
          files.map((f) => `      ${f}`).join('\n')
      )
    } else {
      console.log(`  ok  ${table}`)
    }
  }

  const controls = run_negative_controls(corpus)
  const failed_controls = controls.filter((control) => !control.passed)
  console.log('\nNEGATIVE CONTROLS')
  for (const control of controls) {
    console.log(
      `  [${control.passed ? 'ok' : 'FAIL'}] ${control.result}  ${control.name}`
    )
    if (!control.passed) console.log(`      ${control.detail}`)
  }

  if (errors.length || failed_controls.length) {
    if (errors.length) {
      console.log('\nERRORS:')
      for (const e of errors) console.log(`  x ${e}`)
    }
    if (failed_controls.length) {
      console.log(
        `\n${failed_controls.length} negative control(s) did not hold. Until they do, this ` +
          'gate cannot tell a clean tree from a matcher that has stopped matching.'
      )
    }
    process.exitCode = 1
    return
  }
  console.log('\nno dropped table has a surviving consumer')
}

main()
