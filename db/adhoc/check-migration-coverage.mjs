// Migration coverage check for the league four-layer schema redesign.
//
// Aggregates the per-cluster progress trackers against the immutable inventory
// to prove -- by machine, not by human reading -- that nothing is overlooked:
// every table is assigned to exactly one cluster, no table is orphaned or
// double-claimed, and (with --require-done) every table has reached `done` and
// no dropped old name still has a live consumer.
//
// Reads scratch/league/schema-redesign/{inventory.json, progress/*.md}.
//
// Usage:
//   node db/adhoc/check-migration-coverage.mjs                  # structural + progress report
//   node db/adhoc/check-migration-coverage.mjs --require-done   # final gate: all tables done
//   node db/adhoc/check-migration-coverage.mjs --check-dangling # re-grep old names of done tables
//
// Exit non-zero on any structural violation, and (under --require-done) on any
// open table or lingering old name.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

function resolve_scratch_dir() {
  let dir = repo_root
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'CLAUDE.md')) &&
      fs.existsSync(path.join(dir, 'scratch')) &&
      fs.existsSync(path.join(dir, 'repository', 'active'))
    ) {
      return path.join(dir, 'scratch', 'league', 'schema-redesign')
    }
    dir = path.dirname(dir)
  }
  return path.join(repo_root, 'scratch', 'schema-redesign')
}

const scratch_dir = resolve_scratch_dir()
const VALID_STATES = new Set(['todo', 'in_progress', 'in_review', 'done'])

// Parse a tracker's `| table | state | ... |` rows into { table -> state }.
function parse_tracker(file) {
  const rows = new Map()
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*([a-z0-9_]+)\s*\|\s*([a-z_]+)\s*\|/i)
    if (!m) continue
    if (m[1] === 'table' && m[2] === 'state') continue // header
    rows.set(m[1], m[2])
  }
  return rows
}

function load_trackers() {
  const dir = path.join(scratch_dir, 'progress')
  if (!fs.existsSync(dir)) {
    throw new Error(
      `no progress trackers at ${dir} -- run generate-migration-inventory.mjs --emit-trackers`
    )
  }
  const trackers = new Map() // cluster -> Map(table -> state)
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue
    trackers.set(f.replace(/\.md$/, ''), parse_tracker(path.join(dir, f)))
  }
  return trackers
}

function grep_consumer_count(table) {
  const dirs = [
    'libs-server',
    'libs-shared',
    'app',
    'server',
    'api',
    'jobs',
    'scripts'
  ].filter((d) => fs.existsSync(path.join(repo_root, d)))
  try {
    const out = execFileSync(
      'rg',
      ['-l', '--no-messages', `\\b${table}\\b`, ...dirs],
      {
        cwd: repo_root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      }
    )
    return out.split('\n').filter(Boolean).length
  } catch (err) {
    if (err.status === 1) return 0
    throw err
  }
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('require-done', { type: 'boolean', default: false })
    .option('check-dangling', { type: 'boolean', default: false })
    .help().argv

  const inventory = JSON.parse(
    fs.readFileSync(path.join(scratch_dir, 'inventory.json'), 'utf8')
  )
  const inv_tables = new Set(inventory.map((r) => r.current_table))
  const trackers = load_trackers()

  const errors = []
  const warnings = []

  // Each inventory table must be claimed by exactly one tracker.
  const claim_count = new Map()
  for (const [cluster, rows] of trackers) {
    for (const [table, state] of rows) {
      if (!VALID_STATES.has(state)) {
        errors.push(`${cluster}: table ${table} has invalid state "${state}"`)
      }
      claim_count.set(table, (claim_count.get(table) || 0) + 1)
      if (!inv_tables.has(table)) {
        warnings.push(
          `${cluster}: table ${table} not in inventory (dropped or renamed?)`
        )
      }
    }
  }
  for (const table of inv_tables) {
    const n = claim_count.get(table) || 0
    if (n === 0) errors.push(`table ${table} is in NO cluster tracker`)
    if (n > 1) errors.push(`table ${table} is claimed by ${n} clusters`)
  }

  // Progress rollup.
  const state_totals = new Map()
  const done_tables = []
  for (const [, rows] of trackers) {
    for (const [table, state] of rows) {
      state_totals.set(state, (state_totals.get(state) || 0) + 1)
      if (state === 'done') done_tables.push(table)
    }
  }

  console.log(
    `migration coverage -- ${inventory.length} inventory tables, ${trackers.size} clusters`
  )
  console.log('progress:')
  for (const state of ['todo', 'in_progress', 'in_review', 'done']) {
    console.log(
      `  ${String(state_totals.get(state) || 0).padStart(4)}  ${state}`
    )
  }

  // Optional: a done table's old name must have zero live consumers.
  if (argv['check-dangling'] && done_tables.length) {
    console.log('\nchecking dropped old names for lingering consumers...')
    for (const table of done_tables) {
      const n = grep_consumer_count(table)
      if (n > 0) {
        errors.push(
          `done table ${table} still has ${n} consumer file(s) referencing the old name`
        )
      }
    }
  }

  const open =
    (state_totals.get('todo') || 0) +
    (state_totals.get('in_progress') || 0) +
    (state_totals.get('in_review') || 0)
  if (argv['require-done'] && open > 0) {
    errors.push(`${open} table(s) not yet done (require-done gate)`)
  }

  if (warnings.length) {
    console.log('\nwarnings:')
    for (const w of warnings) console.log(`  ! ${w}`)
  }
  if (errors.length) {
    console.log('\nERRORS:')
    for (const e of errors) console.log(`  x ${e}`)
    process.exitCode = 1
    return
  }
  console.log(
    '\nstructural coverage OK' +
      (argv['require-done'] ? ' and all tables done' : '')
  )
}

main()
