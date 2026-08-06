// Regenerable consumer inventory for the season_grain conformance cluster.
//
// Replaces a hand-enumerated site list. The list this supersedes was measured
// at 28% complete after ten rounds of four parallel sweeps, and it gained five
// citations WHILE its own coverage audit was running -- hand enumeration does
// not converge at this scale, so the durable artifact has to be a script.
//
// WHAT THIS IS: a work-queue generator, not a pass/fail gate. It optimizes for
// RECALL over precision on purpose. A noisy file you open and dismiss costs a
// minute; a missed one costs a production outage, and several sites in this
// cluster fail SILENTLY (an undefined flowing into a suppression key or a
// Math.min) rather than raising 42703. Do not add precision filters that drop
// files -- add tiers that order your reading.
//
// WHY THE TIERS ARE NOT A FILTER. tier1 is "a table name appears in a query
// position", tier2 is "a table name appears at all". It is tempting to sweep
// tier1 and skip tier2. That is wrong in both directions, and both were
// measured on 2026-08-05:
//
//   - libs-server/record-bid-change.mjs is TIER2 and is real work. It resolves
//     its table through a lookup map (`bid_table_by_type[bid_type]`), so no
//     query-anchored pattern can ever see it, and its `season_year: bid.year
//     ?? null` writes a silent null after the rename.
//   - libs-shared/roster.mjs is TIER1 only because a COMMENT reads "used for
//     inserting into rosters_players table", which the case-insensitive
//     `INTO <table>` raw-SQL pattern matches. It contains no knex call at all.
//     Reword that comment and the single highest-severity site in the cluster
//     -- the `rosters_players` getter, whose miss throws on every accepted
//     trade -- silently drops to tier2.
//
// That second case is the same defect class as the one that blinded
// check-saved-view-param-coverage.mjs until 2026-08-05: a matcher that cannot
// tell a consumer from prose ABOUT a consumer. Here it happens to help. It is
// luck, not detection, and it is why the queue is every reported file.
//
// APPLY THE WIRE-VERSUS-COLUMN RULE PER LINE, NOT PER FILE. The wire keeps
// `year`: request params, query strings, and route path segments do not move.
// Only column reads become `season_year`. scripts/calculate-franchise-tag.mjs
// is the canonical example -- five column sites and two wire sites in one file,
// and fixing it per-file in either direction is a defect.
//
// Usage:
//   node db/archive/season-grain-consumer-inventory.mjs            # summary
//   node db/archive/season-grain-consumer-inventory.mjs --files    # file list
//   node db/archive/season-grain-consumer-inventory.mjs --lines    # every line
//   node db/archive/season-grain-consumer-inventory.mjs --json
//   node db/archive/season-grain-consumer-inventory.mjs --verify   # self-test
//
// Always exits 0 except under --verify. It reports scope; it does not judge.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// The 27 in-scope tables. footballoutsiders is the 28th season_grain member and
// is deliberately ABSENT: it is carved out by operator ruling of 2026-07-22 and
// retired by DROP under the DVOA consolidation task, never renamed.
const TABLES = [
  'seasons',
  'league_divisions',
  'teams',
  'users_teams',
  'rosters',
  'rosters_players',
  'transactions',
  'trades',
  'draft',
  'restricted_free_agency_bids',
  'matchups',
  'playoffs',
  'league_team_forecast',
  'league_team_seasonlogs',
  'league_team_player_seasonlogs',
  'league_player_seasonlogs',
  'league_team_lineups',
  'league_team_lineup_starters',
  'league_team_lineup_contributions',
  'league_team_lineup_contribution_weeks',
  'league_baselines',
  'league_format_player_projection_values',
  'league_format_player_projection_values_history',
  'league_format_player_seasonlogs',
  'league_player_projection_values',
  'scoring_format_player_projection_points',
  'scoring_format_player_seasonlogs'
]

// app/ is included even though the SPA never names a table: three of these
// columns reach it, and a renamed field the browser still reads by its old name
// is a user-visible outage the moment the DDL lands. Those files are reported
// under their own tier because the table-name anchor cannot reach them.
const ROOTS = [
  'api',
  'libs-server',
  'libs-shared',
  'scripts',
  'jobs',
  'private',
  'test',
  'db/fixtures',
  'app'
]

const SOURCE_RE = /\.(mjs|js|json|sql)$/

// Shapes where `year` is a WIRE name that must NOT be renamed. Stripped from a
// line before it is classified, so a line carrying both a wire read and a
// column read still reports its column half.
const WIRE_SHAPES = [
  /req\.(?:query|params|body)\.year/g,
  /argv\.year/g,
  /current_season\.year/g,
  /constants\.season\.year/g,
  /\byear_offset\b/g,
  /\bnfl_draft_year\b/g,
  /\bseason_year\b/g,
  /\bsync_context\.year\b/g,
  /\bsync_options\.year\b/g,
  /\bfetch_options\.year\b/g
]

// Ordered most specific first; a line reports its first match.
const COLUMN_SHAPES = [
  [/onConflict\s*\(\s*\[[^\]]*['"`]year['"`]/, 'on-conflict-target'],
  [/['"`](?:\w+\.)?year['"`]/, 'quoted-literal'],
  [/\byear\s*:/, 'object-key'],
  [/\.year\b/, 'property-read'],
  [/\{[^{}]*\byear\b[^{}]*\}/, 'shorthand-or-destructure'],
  [/\byear\b/, 'bare-token']
]

const JOIN_VERBS =
  'from|into|table|join|leftJoin|rightJoin|innerJoin|outerJoin|' +
  'fullOuterJoin|leftOuterJoin|rightOuterJoin|crossJoin|joinRaw'

function query_anchored(text, table) {
  const quoted = `['"\`]${table}(?:\\s+as\\s+\\w+)?['"\`]`
  return (
    new RegExp(`\\b(?:db|trx|knex)\\s*\\(\\s*${quoted}`).test(text) ||
    new RegExp(`\\.(?:${JOIN_VERBS})\\s*\\(\\s*${quoted}`).test(text) ||
    new RegExp(
      `\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+(?:public\\.)?${table}\\b`,
      'i'
    ).test(text) ||
    new RegExp(`['"\`]${table}\\.`).test(text)
  )
}

function walk(dir, out) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walk(full, out)
    } else if (SOURCE_RE.test(entry.name)) {
      out.push(path.relative(repo_root, full))
    }
  }
  return out
}

function classify_lines(text) {
  const found = []
  text.split('\n').forEach((line, index) => {
    if (!/\byear\b/.test(line)) return
    let stripped = line
    for (const shape of WIRE_SHAPES) stripped = stripped.replace(shape, '')
    if (!/\byear\b/.test(stripped)) return
    for (const [pattern, shape] of COLUMN_SHAPES) {
      if (pattern.test(stripped)) {
        found.push({ line: index + 1, shape, text: line.trim() })
        return
      }
    }
  })
  return found
}

function build_inventory() {
  const files = []
  for (const root of ROOTS) walk(path.join(repo_root, root), files)

  const entries = []
  for (const file of files.sort()) {
    let text
    try {
      text = fs.readFileSync(path.join(repo_root, file), 'utf8')
    } catch {
      continue
    }
    const tables = TABLES.filter((t) => new RegExp(`\\b${t}\\b`).test(text))
    const is_spa = file.startsWith('app/')
    if (!tables.length && !is_spa) continue

    const lines = classify_lines(text)
    if (!lines.length) continue

    const anchored = tables.filter((t) => query_anchored(text, t))
    const tier = anchored.length ? 1 : is_spa && !tables.length ? 3 : 2
    entries.push({ file, tier, tables, anchored_tables: anchored, lines })
  }
  return entries
}

// The falsifiable acceptance test. These are the sites that defeated ten rounds
// of hand searching, each for a different structural reason -- a getter with no
// query, a raw fingerprint hashing a bare `year`, a destructured row property,
// a refactor that multiplied one cited site into seven, and a whole subtree
// that fell outside every sweep. A pattern set that misses ANY of them is not
// an oracle yet, and a count from it must not be trusted.
const MUST_REDISCOVER = [
  'libs-shared/roster.mjs',
  'libs-server/roster-asset-lineage/walk-transactions.mjs',
  'scripts/refresh-roster-asset-lineage.mjs',
  'scripts/calculate-franchise-tag.mjs',
  'libs-server/external-fantasy-leagues/sync/transaction-sync.mjs',
  'libs-server/external-fantasy-leagues/sync/roster-sync.mjs',
  'libs-server/external-fantasy-leagues/sync/config-sync.mjs',
  // Tier2-only, and the reason tier2 is never skippable.
  'libs-server/record-bid-change.mjs'
]

function verify(entries) {
  const found = new Set(entries.map((e) => e.file))
  const missing = MUST_REDISCOVER.filter((f) => !found.has(f))
  for (const f of MUST_REDISCOVER) {
    console.log(`  ${found.has(f) ? 'ok  ' : 'MISS'} ${f}`)
  }
  if (missing.length) {
    console.log(
      `\nFAIL: ${missing.length} required site(s) not rediscovered -- ` +
        'this pattern set is not an oracle; do not trust its count'
    )
    process.exitCode = 1
    return
  }
  console.log('\nall required sites rediscovered')
}

function main() {
  const argv = process.argv.slice(2)
  const entries = build_inventory()

  if (argv.includes('--json')) {
    console.log(JSON.stringify(entries, null, 2))
    return
  }
  if (argv.includes('--verify')) {
    verify(entries)
    return
  }

  const total_lines = entries.reduce((sum, e) => sum + e.lines.length, 0)
  const by_tier = {}
  const by_root = {}
  const by_shape = {}
  for (const e of entries) {
    by_tier[e.tier] = (by_tier[e.tier] || 0) + 1
    const root = e.file.startsWith('db/') ? 'db/fixtures' : e.file.split('/')[0]
    by_root[root] = (by_root[root] || 0) + 1
    for (const l of e.lines) by_shape[l.shape] = (by_shape[l.shape] || 0) + 1
  }

  console.log(
    `season_grain consumer inventory -- ${TABLES.length} tables, ` +
      `${entries.length} files, ${total_lines} candidate lines`
  )
  console.log(
    '\ntier 1 (table in a query position): ' +
      `${by_tier[1] || 0}\ntier 2 (table named, no query anchor): ${
        by_tier[2] || 0
      }\ntier 3 (SPA, no table name reachable): ${by_tier[3] || 0}`
  )
  console.log('\nby root:')
  for (const [k, v] of Object.entries(by_root).sort()) {
    console.log(`  ${String(v).padStart(4)}  ${k}`)
  }
  console.log('\nby line shape:')
  for (const [k, v] of Object.entries(by_shape).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`)
  }

  if (argv.includes('--files')) {
    console.log('\nfiles:')
    for (const e of entries) {
      console.log(
        `  t${e.tier}  ${e.file}  (${e.lines.length} lines; ${e.tables.join(
          ','
        )})`
      )
    }
  }
  if (argv.includes('--lines')) {
    console.log('\nlines:')
    for (const e of entries) {
      for (const l of e.lines) {
        console.log(`  ${e.file}:${l.line}  [${l.shape}]  ${l.text}`)
      }
    }
  }

  console.log(
    '\nEvery reported file is in the queue. Tiers order your reading; they ' +
      'do not filter it. Apply the wire-versus-column rule PER LINE.'
  )
}

main()
