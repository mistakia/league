#!/usr/bin/env node

// Repeatable timing harness for data-view serving.
//
// Answers "are we moving in the right direction" for any change to the
// data-view query generator, the schema behind it, or the engine executing it.
// Three subcommands:
//
//   corpus  Select real saved views and record their `table_state`. The corpus
//           file it writes is the committed artifact and holds NO generated
//           SQL -- `run` re-emits the SQL from the working tree every time, so
//           the harness measures the generator you currently have rather than a
//           snapshot of one. That is what makes it answer "did my change to the
//           generator help", and it means only `corpus` ever needs a database
//           holding user_data_views.
//
//   run     Execute a corpus against one named target and write a results file.
//           A target is a DSN plus an engine plus optional session setup SQL,
//           which is how the pg_duckdb arm is expressed (same DSN shape as
//           plain Postgres, plus `SET duckdb.force_execution = true`).
//
//   report  Render one or more results files as a comparable timing table.
//
// Timings are only comparable when the target is ISOLATED. Production timings
// on this workload vary ~3.7x under concurrent batch load, so never point this
// at league_production and treat the output as a comparison.
//
// BOTH subcommands need `#db` pointed at a league-schema database, not just
// `--dsn`: several column definitions query the database while BUILDING their
// SQL (named formats, adp formats), so emitting is not a pure function of
// table_state. Left at the NODE_ENV=test default, `run` reports every such view
// as `generate: role "league_test" does not exist` -- an emit failure that
// reads like a broken view. Set LEAGUE_DB_HOST / LEAGUE_DB_PORT /
// LEAGUE_DB_USER / LEAGUE_DB_DATABASE alongside --dsn.
//
// Examples:
//   node scripts/benchmark-data-views.mjs corpus \
//     --dsn postgres://localhost:15432/league_production --out test/data-view-benchmark/corpus.json
//   node scripts/benchmark-data-views.mjs run \
//     --corpus test/data-view-benchmark/corpus.json --label postgres-baseline \
//     --engine postgres --dsn postgres://localhost:5442/league --runs 3 --out /tmp/pg.json
//   node scripts/benchmark-data-views.mjs report --results /tmp/pg.json /tmp/duck.json

import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import pg from 'pg'

import { is_main, get_data_view_results_query } from '#libs-server'

const exec_file = promisify(execFile)

// console.log, not `debug`: this script's progress output IS its product, and
// the ESM import graph clobbers the debug namespace set before a module-scope
// debug.enable in this file can run -- measured here, the harness logged
// nothing until DEBUG was set explicitly on the command line.
const log = (message) => console.log(message)

// A saved view's table_state omits keys the generator defaults, and stores
// row_axes as the empty string in some rows. Normalize to the shape
// get_data_view_results_query validates.
const normalize_table_state = (table_state) => ({
  columns: table_state.columns ?? [],
  prefix_columns: table_state.prefix_columns ?? [],
  where: table_state.where ?? [],
  sort: table_state.sort ?? [],
  row_axes: Array.isArray(table_state.row_axes) ? table_state.row_axes : [],
  row_grain: table_state.row_grain ?? ['player'],
  offset: table_state.offset ?? 0,
  limit: table_state.limit ?? 500
})

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ---------------------------------------------------------------- corpus ---

const build_corpus = async (argv) => {
  const client = new pg.Client({ connectionString: argv.dsn })
  await client.connect()

  let rows
  if (argv.view_ids?.length) {
    const result = await client.query(
      'select view_id, view_name, table_state from user_data_views where view_id = any($1)',
      [argv.view_ids]
    )
    rows = result.rows
  } else {
    const result = await client.query(
      'select view_id, view_name, table_state from user_data_views'
    )
    rows = result.rows
  }
  await client.end()

  log(`loaded ${rows.length} saved views`)

  const entries = []
  const failures = []
  for (const row of rows) {
    const table_state = normalize_table_state(
      typeof row.table_state === 'string'
        ? JSON.parse(row.table_state)
        : row.table_state
    )
    if (!table_state.columns.length) {
      failures.push({ view_id: row.view_id, error: 'no_columns' })
      continue
    }
    // Generating the SQL here is a selection filter, not an artifact: a view
    // whose SQL cannot even be built is not a benchmark subject. The SQL itself
    // is deliberately NOT stored -- `run` re-emits it.
    try {
      await get_data_view_results_query(table_state)
      entries.push({
        view_id: row.view_id,
        view_name: row.view_name,
        row_grain: table_state.row_grain,
        row_axes: table_state.row_axes,
        column_count: table_state.columns.length,
        where_count: table_state.where.length,
        table_state
      })
    } catch (error) {
      failures.push({ view_id: row.view_id, error: error.message })
    }
  }

  const corpus = {
    generated_at: new Date().toISOString(),
    source_database: new URL(argv.dsn).pathname.replace('/', ''),
    entry_count: entries.length,
    failure_count: failures.length,
    entries,
    failures
  }

  await fs.mkdir(path.dirname(argv.out), { recursive: true })
  await fs.writeFile(argv.out, JSON.stringify(corpus, null, 2))
  log(
    `wrote ${entries.length} entries (${failures.length} failed to generate) to ${argv.out}`
  )
}

// ------------------------------------------------------------ run: engines --

const run_postgres = async ({ dsn, setup_sql, entries, runs, timeout_ms }) => {
  const client = new pg.Client({
    connectionString: dsn,
    statement_timeout: timeout_ms
  })
  await client.connect()
  for (const statement of setup_sql) {
    log(`setup: ${statement}`)
    await client.query(statement)
  }

  const results = []
  for (const entry of entries) {
    const timings = []
    let error = null
    let row_count = null
    for (let i = 0; i < runs; i++) {
      const started = process.hrtime.bigint()
      try {
        const result = await client.query(entry.sql)
        timings.push(Number(process.hrtime.bigint() - started) / 1e6)
        row_count = result.rowCount
      } catch (e) {
        error = e.message
        break
      }
    }
    results.push({ view_id: entry.view_id, timings, row_count, error })
    log(
      `${entry.view_name}: ${error ? `ERROR ${error}` : `${median(timings).toFixed(0)}ms (${row_count} rows)`}`
    )
  }

  await client.end()
  return results
}

// DuckDB is driven through its CLI rather than a node binding so the harness
// adds no dependency to package.json. `.timer on` reports the query's own
// execution time, which excludes process startup -- that is the number we want,
// and it is why wall time of the child process is not used.
const run_duckdb = async ({ dsn, setup_sql, entries, runs, timeout_ms }) => {
  const results = []
  for (const entry of entries) {
    const timings = []
    let error = null
    let row_count = null

    const script_path = path.join(
      os.tmpdir(),
      `benchmark-data-views-${entry.view_id}.sql`
    )
    // COUNT(*) over the query keeps the CLI from rendering (and us from
    // parsing) a wide result set, while still forcing full execution.
    const body = [
      ...setup_sql.map((s) => `${s.replace(/;$/, '')};`),
      '.timer on',
      ...Array.from(
        { length: runs },
        () => `select count(*) from (\n${entry.sql}\n) as benchmark_subject;`
      )
    ].join('\n')
    await fs.writeFile(script_path, `${body}\n`)

    try {
      const { stdout } = await exec_file('duckdb', [dsn, '-f', script_path], {
        timeout: timeout_ms,
        maxBuffer: 64 * 1024 * 1024
      })
      for (const match of stdout.matchAll(/Run Time \(s\): real ([0-9.]+)/g)) {
        timings.push(Number(match[1]) * 1000)
      }
      const count_match = stdout.match(/^\s*│\s*(\d+)\s*│\s*$/m)
      if (count_match) row_count = Number(count_match[1])
      if (!timings.length) error = 'no_timing_reported'
    } catch (e) {
      error = (e.stderr || e.message || String(e)).trim().split('\n')[0]
    }
    await fs.rm(script_path, { force: true })

    results.push({ view_id: entry.view_id, timings, row_count, error })
    log(
      `${entry.view_name}: ${error ? `ERROR ${error}` : `${median(timings).toFixed(0)}ms (${row_count} rows)`}`
    )
  }
  return results
}

const run_corpus = async (argv) => {
  const corpus = JSON.parse(await fs.readFile(argv.corpus, 'utf8'))
  let entries = corpus.entries
  if (argv.view_ids?.length) {
    const want = new Set(argv.view_ids)
    entries = entries.filter((e) => want.has(e.view_id))
  }
  if (argv.max_entries) entries = entries.slice(0, argv.max_entries)

  // Re-emit from the working tree rather than replaying stored SQL, so a run
  // measures the generator as it stands now. A view whose SQL no longer builds
  // is reported as an error rather than silently dropped -- that is a result.
  const emit_failures = []
  const emitted = []
  for (const entry of entries) {
    try {
      const { query } = await get_data_view_results_query(entry.table_state)
      emitted.push({ ...entry, sql: query.toString() })
    } catch (error) {
      emit_failures.push({ ...entry, error: `generate: ${error.message}` })
    }
  }
  entries = emitted

  if (argv.dump_sql) {
    await fs.mkdir(argv.dump_sql, { recursive: true })
    for (const entry of entries) {
      await fs.writeFile(
        path.join(argv.dump_sql, `${entry.view_id}.sql`),
        entry.sql
      )
    }
    log(`dumped ${entries.length} statements to ${argv.dump_sql}`)
  }

  log(
    `running ${entries.length} entries against ${argv.label} (${argv.engine}), ${argv.runs} runs each` +
      (emit_failures.length
        ? ` (${emit_failures.length} failed to generate)`
        : '')
  )

  const engine = argv.engine === 'duckdb' ? run_duckdb : run_postgres
  const results = await engine({
    dsn: argv.dsn,
    setup_sql: argv.setup_sql ?? [],
    entries,
    runs: argv.runs,
    timeout_ms: argv.timeout
  })

  const by_view = new Map(entries.map((e) => [e.view_id, e]))
  const output = {
    label: argv.label,
    engine: argv.engine,
    setup_sql: argv.setup_sql ?? [],
    runs: argv.runs,
    ran_at: new Date().toISOString(),
    corpus_generated_at: corpus.generated_at,
    results: [
      ...results.map((r) => ({
        ...r,
        view_name: by_view.get(r.view_id).view_name,
        column_count: by_view.get(r.view_id).column_count,
        row_grain: by_view.get(r.view_id).row_grain,
        median_ms: r.timings.length ? median(r.timings) : null,
        min_ms: r.timings.length ? Math.min(...r.timings) : null
      })),
      ...emit_failures.map((f) => ({
        view_id: f.view_id,
        view_name: f.view_name,
        column_count: f.column_count,
        row_grain: f.row_grain,
        timings: [],
        row_count: null,
        error: f.error,
        median_ms: null,
        min_ms: null
      }))
    ]
  }

  await fs.mkdir(path.dirname(argv.out), { recursive: true })
  await fs.writeFile(argv.out, JSON.stringify(output, null, 2))
  log(`wrote ${output.results.length} results to ${argv.out}`)

  const ok = output.results.filter((r) => !r.error).length
  log(`succeeded: ${ok}/${output.results.length}`)
}

// ---------------------------------------------------------------- report ---

const render_report = async (argv) => {
  const files = []
  for (const file of argv.results) {
    files.push(JSON.parse(await fs.readFile(file, 'utf8')))
  }

  const view_ids = []
  for (const file of files) {
    for (const result of file.results) {
      if (!view_ids.includes(result.view_id)) view_ids.push(result.view_id)
    }
  }

  const name_for = (view_id) => {
    for (const file of files) {
      const hit = file.results.find((r) => r.view_id === view_id)
      if (hit) return hit.view_name
    }
    return view_id
  }
  const cols_for = (view_id) => {
    for (const file of files) {
      const hit = file.results.find((r) => r.view_id === view_id)
      if (hit) return hit.column_count
    }
    return null
  }

  const header = ['view', 'cols', ...files.map((f) => f.label)]
  const rows = view_ids.map((view_id) => {
    const cells = files.map((file) => {
      const hit = file.results.find((r) => r.view_id === view_id)
      if (!hit) return '-'
      if (hit.error) return `ERR: ${hit.error.slice(0, 40)}`
      return `${hit.median_ms.toFixed(0)}ms`
    })
    return [name_for(view_id).slice(0, 44), String(cols_for(view_id)), ...cells]
  })

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  )
  const line = (cells) =>
    cells
      .map((c, i) => c.padEnd(widths[i]))
      .join('  ')
      .trimEnd()

  console.log(line(header))
  console.log(widths.map((w) => '-'.repeat(w)).join('  '))
  for (const row of rows) console.log(line(row))

  console.log('')
  for (const file of files) {
    const ok = file.results.filter((r) => !r.error)
    const total = ok.reduce((sum, r) => sum + r.median_ms, 0)
    console.log(
      `${file.label}: ${ok.length}/${file.results.length} succeeded, total median ${(total / 1000).toFixed(1)}s`
    )
  }
}

// ------------------------------------------------------------------ main ---

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .command('corpus', 'build a query corpus from saved views', (y) =>
      y
        .option('dsn', {
          type: 'string',
          demandOption: true,
          describe: 'postgres DSN to read user_data_views from'
        })
        .option('out', { type: 'string', demandOption: true })
        .option('view_ids', {
          type: 'array',
          describe: 'restrict to these view ids (default: every saved view)'
        })
    )
    .command('run', 'execute a corpus against one target', (y) =>
      y
        .option('corpus', { type: 'string', demandOption: true })
        .option('label', { type: 'string', demandOption: true })
        .option('engine', {
          type: 'string',
          choices: ['postgres', 'duckdb'],
          default: 'postgres'
        })
        .option('dsn', {
          type: 'string',
          demandOption: true,
          describe: 'postgres DSN, or a duckdb database file path'
        })
        .option('setup_sql', {
          type: 'array',
          default: [],
          describe: 'statements run once before timing (session GUCs)'
        })
        .option('runs', { type: 'number', default: 3 })
        .option('timeout', { type: 'number', default: 300000 })
        .option('max_entries', { type: 'number' })
        .option('view_ids', { type: 'array' })
        .option('dump_sql', {
          type: 'string',
          describe: 'directory to write each generated statement to'
        })
        .option('out', { type: 'string', demandOption: true })
    )
    .command('report', 'render results files as a timing table', (y) =>
      y.option('results', { type: 'array', demandOption: true })
    )
    .demandCommand(1)
    .strict()
    .help().argv

  const command = argv._[0]
  if (command === 'corpus') await build_corpus(argv)
  else if (command === 'run') await run_corpus(argv)
  else if (command === 'report') await render_report(argv)
}

if (is_main(import.meta.url)) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error)
      process.exit(1)
    }
  )
}

export default main
