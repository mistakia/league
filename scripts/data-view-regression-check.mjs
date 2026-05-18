// Data-view regression check.
//
// For each fixture under test/data-view-queries/, compares the generated SQL
// produced by two code revisions ("base" and "head"), executes any SQL that
// changed against the production database (read-only transaction), hashes the
// rows, and reports per-fixture status: unchanged | equivalent | regression |
// new | error.
//
// Default mode reads each side's SQL from the fixture's `expected_query`
// field -- on the working tree for head, via `git show <base-ref>:...` for
// base. Pass --regen-base/--regen-head to instead build SQL by invoking
// get_data_view_results_query inside the appropriate code checkout (a cached
// git worktree at the base ref, and the working tree for head). Use regen
// when expected_query has drifted on both sides simultaneously (e.g. mid
// migration) and the stored strings can't be trusted to reflect the code.
//
// Usage:
//   NODE_ENV=production node scripts/data-view-regression-check.mjs [opts]
//   --base-ref <ref>     git ref for the base side (default: origin/main)
//   --regen-base         rebuild base SQL via worktree at base-ref
//   --regen-head         rebuild head SQL from working tree
//   --fixture <name>     limit to one fixture (repeatable)
//   --refresh-worktree   force re-create the base worktree
//   --concurrency <n>    parallel query executions (default: 4)
//   --sample-rows <n>    rows to print per regression (default: 5)
//   --json               emit a single JSON report on stdout (default: text)

import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { spawn, execSync } from 'child_process'
import { fileURLToPath } from 'url'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// db is imported lazily inside execute_sql so --help / dry inspection works
// without NODE_ENV set; live runs require NODE_ENV (production by convention).
// Same reason for direct imports below: the #libs-server barrel pulls in
// modules that touch #config at import time.
import is_main from '#libs-server/is-main.mjs'
import { load_data_view_test_queries_sync } from '#libs-server/load-test-cases.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.resolve(__dirname, '..')
const worktree_root = path.join(project_root, '.cache', 'data-view-regression-worktree')

const argv = yargs(hideBin(process.argv))
  .option('base-ref', { type: 'string', default: 'origin/main' })
  .option('regen-base', { type: 'boolean', default: false })
  .option('regen-head', { type: 'boolean', default: false })
  .option('fixture', { type: 'array', default: [] })
  .option('refresh-worktree', { type: 'boolean', default: false })
  .option('concurrency', { type: 'number', default: 4 })
  .option('sample-rows', { type: 'number', default: 5 })
  .option('json', { type: 'boolean', default: false })
  .strict()
  .parseSync()

const log = (msg) => {
  if (!argv.json) process.stderr.write(msg + '\n')
}

// ---------- Fixture selection ----------

const select_fixtures = () => {
  const all = load_data_view_test_queries_sync()
  if (!argv.fixture.length) return all
  const want = new Set(argv.fixture.map(String))
  return all.filter((f) => want.has(f.filename))
}

// ---------- SQL sourcing ----------

const read_head_sql_stored = (filename) => {
  const fp = path.join(project_root, 'test', 'data-view-queries', filename)
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'))
  return j.expected_query || null
}

const read_base_sql_stored = (filename) => {
  try {
    const buf = execSync(
      `git show ${argv['base-ref']}:test/data-view-queries/${filename}`,
      { cwd: project_root, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const j = JSON.parse(buf.toString('utf8'))
    return j.expected_query || null
  } catch {
    return null // fixture absent from base ref
  }
}

const run_build_sql = ({ cwd, filenames }) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['scripts/data-view-regression-build-sql.mjs'],
      { cwd, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c))
    child.stderr.on('data', (c) => (stderr += c))
    child.on('error', reject)
    child.stdin.end(JSON.stringify(filenames))
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`build-sql exited ${code}: ${stderr.trim()}`))
      }
      try { resolve(JSON.parse(stdout)) } catch (e) { reject(new Error(`build-sql JSON parse: ${e.message}\n${stdout.slice(0, 500)}`)) }
    })
  })

// ---------- Worktree ----------

const ensure_worktree = () => {
  const ref = argv['base-ref']
  if (argv['refresh-worktree'] && fs.existsSync(worktree_root)) {
    log(`[worktree] removing existing ${worktree_root}`)
    execSync(`git worktree remove --force ${JSON.stringify(worktree_root)}`, { cwd: project_root })
  }
  if (!fs.existsSync(worktree_root)) {
    log(`[worktree] git worktree add ${worktree_root} ${ref}`)
    fs.mkdirSync(path.dirname(worktree_root), { recursive: true })
    // Route git stdout to our stderr to keep --json mode's stdout clean.
    execSync(`git fetch --quiet`, { cwd: project_root, stdio: ['ignore', 2, 'inherit'] })
    execSync(`git worktree add --detach ${JSON.stringify(worktree_root)} ${ref}`, { cwd: project_root, stdio: ['ignore', 2, 'inherit'] })
    // share node_modules with the main checkout -- avoids a second yarn install
    const link = path.join(worktree_root, 'node_modules')
    if (!fs.existsSync(link)) {
      fs.symlinkSync(path.join(project_root, 'node_modules'), link, 'dir')
    }
  } else {
    log(`[worktree] refreshing ${worktree_root} to ${ref}`)
    execSync(`git fetch --quiet`, { cwd: project_root, stdio: ['ignore', 2, 'inherit'] })
    execSync(`git reset --hard ${ref}`, { cwd: worktree_root, stdio: ['ignore', 2, 'inherit'] })
    // git reset --hard may remove or replace node_modules if it was tracked at
    // the base ref. Re-create the symlink idempotently so the worktree always
    // shares the main checkout's node_modules without a separate yarn install.
    const refresh_link = path.join(worktree_root, 'node_modules')
    const link_target = path.join(project_root, 'node_modules')
    let needs_symlink = !fs.existsSync(refresh_link)
    if (!needs_symlink) {
      try {
        const stat = fs.lstatSync(refresh_link)
        if (!stat.isSymbolicLink() || fs.realpathSync(refresh_link) !== fs.realpathSync(link_target)) {
          fs.rmSync(refresh_link, { recursive: true, force: true })
          needs_symlink = true
        }
      } catch {
        needs_symlink = true
      }
    }
    if (needs_symlink) {
      fs.symlinkSync(link_target, refresh_link, 'dir')
    }
  }
  // The build-sql helper may not exist at the base ref. Copy the head version
  // in; it only calls get_data_view_results_query + load_data_view_test_queries_sync
  // via #libs-server, which will resolve to the worktree's own code.
  fs.copyFileSync(
    path.join(project_root, 'scripts', 'data-view-regression-build-sql.mjs'),
    path.join(worktree_root, 'scripts', 'data-view-regression-build-sql.mjs')
  )
}

// ---------- Row hashing ----------

const normalize_row = (row, columns) => {
  const out = {}
  for (const col of columns) out[col] = row[col] === undefined ? null : row[col]
  return out
}

const hash_rows_with_meta = (rows) => {
  const arr = Array.isArray(rows) ? rows : []
  const columns = arr.length ? Object.keys(arr[0]).sort() : []
  const normalized = arr.map((r) => normalize_row(r, columns))
  const sorted = [...normalized].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  )
  const h = crypto.createHash('sha256')
  for (const r of sorted) h.update(JSON.stringify(r) + '\n')
  return {
    row_count: sorted.length,
    column_count: columns.length,
    row_hash: h.digest('hex'),
    rows: sorted
  }
}

// ---------- DB execution (read-only) ----------

let _db = null
const get_db = async () => {
  if (_db) return _db
  if (!process.env.NODE_ENV) {
    throw new Error('NODE_ENV must be set (production for live regression checks)')
  }
  _db = (await import('#db')).default
  return _db
}

const execute_sql = async (sql) => {
  const db = await get_db()
  // Each fixture's SQL runs inside an explicit READ ONLY transaction; a session
  // statement_timeout is also set to bound runaway queries.
  return db.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION READ ONLY')
    await trx.raw("SET LOCAL statement_timeout = '120s'")
    const result = await trx.raw(sql)
    // node-pg returns {rows, ...}; if a different driver returns an array,
    // accept it as-is.
    return Array.isArray(result) ? result : result.rows
  })
}

const map_with_concurrency = async (items, limit, fn) => {
  const results = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- Main ----------

const sample_diff_rows = (head_rows, base_rows, n) => {
  const key = (r) => JSON.stringify(r)
  const base_set = new Set(base_rows.map(key))
  const head_set = new Set(head_rows.map(key))
  const only_head = head_rows.filter((r) => !base_set.has(key(r))).slice(0, n)
  const only_base = base_rows.filter((r) => !head_set.has(key(r))).slice(0, n)
  return { only_head, only_base }
}

const main = async () => {
  const fixtures = select_fixtures()
  if (!fixtures.length) {
    log('No fixtures matched.')
    process.exit(1)
  }
  log(`Comparing ${fixtures.length} fixture(s); base=${argv['base-ref']}`)

  // Worktree only needed when regenerating base SQL.
  if (argv['regen-base']) ensure_worktree()

  // Source SQL for both sides.
  const filenames = fixtures.map((f) => f.filename)
  log(`[sql] sourcing head SQL (${argv['regen-head'] ? 'regen' : 'stored'})`)
  const head_sql = argv['regen-head']
    ? await run_build_sql({ cwd: project_root, filenames })
    : Object.fromEntries(filenames.map((fn) => [fn, { sql: read_head_sql_stored(fn), error: null }]))

  log(`[sql] sourcing base SQL (${argv['regen-base'] ? 'regen' : 'stored'})`)
  const base_sql = argv['regen-base']
    ? await run_build_sql({ cwd: worktree_root, filenames })
    : Object.fromEntries(filenames.map((fn) => [fn, { sql: read_base_sql_stored(fn), error: null }]))

  // Per-fixture classify + execute.
  const entries = await map_with_concurrency(fixtures, argv.concurrency, async (fixture) => {
    const fn = fixture.filename
    const head = head_sql[fn] || { sql: null, error: 'missing in head set' }
    const base = base_sql[fn] || { sql: null, error: null }

    if (head.error) return { fixture: fn, status: 'error_build_head', detail: head.error }
    if (!head.sql) return { fixture: fn, status: 'error_build_head', detail: 'no SQL on head' }
    if (!base.sql && !base.error) return { fixture: fn, status: 'new', detail: 'fixture absent on base ref' }
    if (base.error) return { fixture: fn, status: 'error_build_base', detail: base.error }

    if (head.sql === base.sql) {
      return { fixture: fn, status: 'unchanged' }
    }

    // SQL differs: execute both, hash, compare.
    let head_rows, base_rows
    try { head_rows = await execute_sql(head.sql) } catch (e) {
      return { fixture: fn, status: 'error_head', detail: e.message, head_sql: head.sql, base_sql: base.sql }
    }
    try { base_rows = await execute_sql(base.sql) } catch (e) {
      return { fixture: fn, status: 'error_base', detail: e.message, head_sql: head.sql, base_sql: base.sql }
    }

    const head_h = hash_rows_with_meta(head_rows)
    const base_h = hash_rows_with_meta(base_rows)

    if (head_h.row_hash === base_h.row_hash) {
      return {
        fixture: fn,
        status: 'equivalent',
        row_count: head_h.row_count,
        column_count: head_h.column_count
      }
    }

    const { only_head, only_base } = sample_diff_rows(head_h.rows, base_h.rows, argv['sample-rows'])
    return {
      fixture: fn,
      status: 'regression',
      head_row_count: head_h.row_count,
      base_row_count: base_h.row_count,
      head_row_hash: head_h.row_hash,
      base_row_hash: base_h.row_hash,
      sample_only_in_head: only_head,
      sample_only_in_base: only_base
    }
  })

  if (_db) await _db.destroy()

  // Report.
  const by_status = entries.reduce((acc, e) => {
    (acc[e.status] = acc[e.status] || []).push(e)
    return acc
  }, {})

  if (argv.json) {
    process.stdout.write(JSON.stringify({ base_ref: argv['base-ref'], entries }, null, 2) + '\n')
  } else {
    const order = ['regression', 'error_head', 'error_base', 'error_build_head', 'error_build_base', 'equivalent', 'new', 'unchanged']
    for (const status of order) {
      const items = by_status[status] || []
      if (!items.length) continue
      log(`\n[${status}] ${items.length}`)
      for (const e of items) {
        if (status === 'regression') {
          log(`  ${e.fixture}: rows ${e.base_row_count} -> ${e.head_row_count}, hash ${e.base_row_hash.slice(0, 12)} -> ${e.head_row_hash.slice(0, 12)}`)
          if (e.sample_only_in_base.length) log(`    only in base (sample): ${JSON.stringify(e.sample_only_in_base).slice(0, 400)}`)
          if (e.sample_only_in_head.length) log(`    only in head (sample): ${JSON.stringify(e.sample_only_in_head).slice(0, 400)}`)
        } else if (status.startsWith('error')) {
          log(`  ${e.fixture}: ${e.detail}`)
        } else {
          log(`  ${e.fixture}`)
        }
      }
    }
    const regressions = (by_status.regression || []).length
    const errors = ['error_head', 'error_base', 'error_build_head', 'error_build_base'].reduce(
      (n, k) => n + (by_status[k] || []).length, 0
    )
    log(`\nSummary: ${regressions} regression(s), ${errors} error(s), ${(by_status.equivalent || []).length} equivalent, ${(by_status.unchanged || []).length} unchanged, ${(by_status.new || []).length} new${os.EOL}`)
    if (regressions || errors) process.exit(2)
  }
}

if (is_main(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write(`fatal: ${e && e.stack ? e.stack : e}\n`)
    process.exit(1)
  })
}
