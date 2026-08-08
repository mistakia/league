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
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// Tables dropped over the course of the schema redesign. Append here in the
// same commit that drops a table. Every entry is asserted absent from
// db/schema.postgres.sql below, so a name that is later re-created fails loudly
// rather than silently checking nothing.
const DROPPED_TABLES = [
  'external_league_import_job_history',
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
    `\\b(?:db|trx|knex)\\s*\\(\\s*${quoted}`,
    // .from('schedule'), .leftJoin('schedule as s', ...)
    `\\.(?:${joins})\\s*\\(\\s*${quoted}`,
    // raw SQL: FROM schedule, JOIN public.schedule, INSERT INTO schedule, ...
    `(?i)\\b(?:from|join|into|update|table)\\s+(?:public\\.)?${t}\\b`
  ]
}

function grep_consumer_files(table) {
  const dirs = [
    'libs-server',
    'libs-shared',
    'app',
    'server',
    'api',
    'jobs',
    'scripts'
  ].filter((d) => fs.existsSync(path.join(repo_root, d)))
  const patterns = table_reference_patterns(table).flatMap((p) => ['-e', p])
  try {
    const out = execFileSync(
      'rg',
      ['-l', '--no-messages', ...patterns, ...dirs],
      {
        cwd: repo_root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      }
    )
    return out.split('\n').filter(Boolean)
  } catch (err) {
    if (err.status === 1) return []
    throw err
  }
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

  for (const table of dropped) {
    const files = grep_consumer_files(table)
    if (files.length) {
      errors.push(
        `dropped table ${table} still has ${files.length} consumer file(s):\n` +
          files.map((f) => `      ${f}`).join('\n')
      )
    } else {
      console.log(`  ok  ${table}`)
    }
  }

  if (errors.length) {
    console.log('\nERRORS:')
    for (const e of errors) console.log(`  x ${e}`)
    process.exitCode = 1
    return
  }
  console.log('\nno dropped table has a surviving consumer')
}

main()
