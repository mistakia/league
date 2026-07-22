// Fantasy-stat vocabulary repoint / dangling-name gate for the four-layer schema
// redesign (user:task/league/redesign-league-database-schema.md), fantasy-stat
// cluster. The analog of check-player-column-repoint.mjs for the shared
// fantasy-scoring vocabulary (libs-shared/constants/stats-constants.mjs
// all_fantasy_stats) that lives as columns on the in-scope tables in
// ./fantasy-stat-renames.mjs.
//
// It scans consumer code for the two high-confidence dangling patterns and gates
// on them, and surfaces the constant-array source sites as review context:
//   GATE   <in_scope_table>.<code>            -- qualified raw-SQL access
//   GATE   column_name: '<code>'              -- structured data-view defs
//   WARN   the stat-constant arrays themselves -- the vocabulary source
//
// BLIND SPOTS -- this gate is a FLOOR, not the contract gate, and it is FAR noisier
// and weaker than the player one because the codes are two-to-six-letter tokens
// (pa, pc, ry, rec, dtd) used as bare object keys all through the scoring engine.
// It is structurally blind to every consumer that reads a renamed stat WITHOUT a
// `<table>.`/`column_name:` prefix:
//   - object property reads: gamelog.recy / player_row.py / points.pa / stats[field]
//   - the dynamic frontend read player-selected-row.js stats[field] over the codes
//   - Knex shorthand db('player_gamelogs').where({ py }) / .select(['pa','py',...])
//   - calculate-points.mjs, which drives scoring by iterating the constant arrays
//   - the ENTIRE private/ submodule (SCAN_DIRS omits it)
// The REAL gate is the scoring result-equivalence suite plus the post-migration
// full mocha suite run against a schema that carries the new column names; treat a
// clean `--gate` here as necessary, never sufficient.
//
// Usage:
//   node db/adhoc/check-fantasy-stat-repoint.mjs            # full report
//   node db/adhoc/check-fantasy-stat-repoint.mjs --gate     # exit 1 if any GATE hit
//   node db/adhoc/check-fantasy-stat-repoint.mjs --code recy # scope to one code
//   node db/adhoc/check-fantasy-stat-repoint.mjs --json     # machine-readable
//
// Exit 0 = no gated dangling references; 1 = gated references remain; 2 = error.

import path from 'path'
import fs from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  FANTASY_STAT_RENAMES,
  IN_SCOPE_TABLES
} from './fantasy-stat-renames.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

const SCAN_DIRS = [
  'libs-server',
  'libs-shared',
  'app',
  'server',
  'api',
  'jobs',
  'scripts'
]
const DEFINITIONS_DIR = 'libs-server/data-views-column-definitions'

// Partitioned parents in IN_SCOPE_TABLES also carry _year_/_default children whose
// qualified names appear in raw SQL; match the child forms too.
const scoped_table_alternation = IN_SCOPE_TABLES.map(
  (t) => `${t}(?:_year_[0-9]{4}|_y[0-9]{4}|_default)?`
).join('|')

function rg(args) {
  try {
    const out = execFileSync('rg', ['--no-messages', ...args], {
      cwd: repo_root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024
    })
    return out.split('\n').filter(Boolean)
  } catch (err) {
    if (err.status === 1) return [] // rg: no matches
    throw err
  }
}

function parse_hits(lines) {
  return lines
    .map((line) => {
      const m = line.match(/^([^:]+):(\d+):(\d+):(.*)$/)
      if (!m) return null
      return { file: m[1], line: Number(m[2]), text: m[4].trim() }
    })
    .filter(Boolean)
}

function scan_code(code) {
  const dirs = SCAN_DIRS.filter((d) => fs.existsSync(path.join(repo_root, d)))
  // GATE 1: qualified <in_scope_table>.<code>
  const qualified = parse_hits(
    rg([
      '--vimgrep',
      '-e',
      `\\b(${scoped_table_alternation})\\.${code}\\b`,
      ...dirs
    ])
  )
  // GATE 2: structured data-view column definitions column_name: '<code>'
  const defs = fs.existsSync(path.join(repo_root, DEFINITIONS_DIR))
    ? parse_hits(
        rg([
          '--vimgrep',
          '-e',
          `column_name:\\s*['"]${code}['"]`,
          DEFINITIONS_DIR
        ])
      )
    : []
  return { gate: [...qualified, ...defs] }
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('gate', { type: 'boolean', default: false })
    .option('code', { type: 'string' })
    .option('json', { type: 'boolean', default: false })
    .strict(false)
    .parse()

  const codes = argv.code ? [argv.code] : Object.keys(FANTASY_STAT_RENAMES)
  if (argv.code && !FANTASY_STAT_RENAMES[argv.code]) {
    console.error(`unknown fantasy-stat code: ${argv.code}`)
    process.exitCode = 2
    return
  }

  const results = {}
  let gate_total = 0
  for (const code of codes) {
    const { gate } = scan_code(code)
    if (gate.length) {
      results[code] = { new: FANTASY_STAT_RENAMES[code], gate }
      gate_total += gate.length
    }
  }

  if (argv.json) {
    console.log(JSON.stringify({ gate_total, results }, null, 2))
  } else {
    for (const [code, { new: new_col, gate }] of Object.entries(results)) {
      console.log(`\n${code} -> ${new_col}  (${gate.length} gate)`)
      for (const h of gate) console.log(`  GATE ${h.file}:${h.line}  ${h.text}`)
    }
    console.log(
      `\n${gate_total} gated dangling reference(s) across ${
        Object.keys(results).length
      } code(s)`
    )
    console.log(
      'REMINDER: floor only -- the scoring result-equivalence + full mocha suites are the real gate.'
    )
  }

  if (gate_total > 0) {
    if (!argv.json)
      console.log(
        '\nGATE FAIL: old fantasy-stat column names still referenced.'
      )
    process.exitCode = 1
  } else if (!argv.json) {
    console.log(
      '\nGATE OK: no qualified/structured old fantasy-stat references.'
    )
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
