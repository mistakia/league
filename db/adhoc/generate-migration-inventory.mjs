// Migration inventory generator for the league four-layer schema redesign.
//
// Enumerates every current table from db/schema.postgres.sql, attaches each
// table's columns, greps the repo for every file that references the table by
// name, and assigns exactly one domain cluster. The output is the anti-omission
// spine of the migration: completeness is by construction, not memory, and a
// branched session claims a whole cluster from it.
//
// The inventory is IMMUTABLE and REGENERABLE -- never hand-edit inventory.json;
// re-run this to refresh it. Mutable per-cluster state lives in the separate
// progress/<cluster>.md trackers (see --emit-trackers).
//
// Usage:
//   node db/adhoc/generate-migration-inventory.mjs                 # write inventory.json
//   node db/adhoc/generate-migration-inventory.mjs --no-consumers  # skip the repo grep (fast)
//   node db/adhoc/generate-migration-inventory.mjs --emit-trackers # also stub progress/<cluster>.md
//   node db/adhoc/generate-migration-inventory.mjs --summary       # print cluster distribution only
//
// Output roots resolve to the user-base scratch slug when run inside user-base,
// else to a local ./scratch fallback for a standalone clone.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(__dirname, '..', 'schema.postgres.sql')

// Resolve the user-base root by marker so the scratch slug lands in the right
// place from either the canonical submodule checkout or a worktree; fall back
// to a repo-local scratch dir off a standalone clone.
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

// --- schema parsing (tables + columns) ---------------------------------------

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
    if (/^\);/.test(raw.trim()) || raw.trim() === ')') {
      tables.set(current, columns)
      current = null
      columns = null
      continue
    }
    const trimmed = raw.trim().replace(/,$/, '')
    if (!trimmed) continue
    if (
      /^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|EXCLUDE|PARTITION|LIKE)\b/i.test(
        trimmed
      )
    ) {
      continue
    }
    const q = trimmed.match(/^"([^"]+)"\s+/)
    const b = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/)
    if (q) columns.push(q[1])
    else if (b) columns.push(b[1])
  }
  return tables
}

// A `<base>_year_YYYY` child duplicates its parent's columns; fold it into the
// parent so the inventory records the logical table once and lists its children.
function fold_partitions(tables) {
  const folded = new Map()
  const children = new Map()
  for (const [table, columns] of tables) {
    const m = table.match(/^(.+)_year_\d{4}$/)
    if (m && tables.has(m[1])) {
      if (!children.has(m[1])) children.set(m[1], [])
      children.get(m[1]).push(table)
    } else {
      folded.set(table, { columns })
    }
  }
  for (const [parent, kids] of children) {
    if (folded.has(parent)) folded.get(parent).partitions = kids.sort()
  }
  return folded
}

// --- cluster assignment (exactly one per table; first rule wins) -------------

// Ordered, most-specific-first. Each entry: [cluster, predicate]. The order is
// load-bearing: a table matches the first predicate that fires.
const CLUSTER_RULES = [
  // College scope (before generic player/game rules).
  ['pff-charting-college', (t) => /^ncaa_/.test(t)],
  ['college-logs', (t) => /^player_college_/.test(t) || /^college_/.test(t)],
  // Identity / crosswalk core (before the pff-* and nfl-fact rules so its
  // player-dimension and person tables are not swept by broader patterns).
  [
    'identity-crosswalk',
    (t) =>
      t === 'player' ||
      /^player_(alias|changelog|external_id|pair_correlations|prospect_profile|archetypes)/.test(
        t
      ) ||
      t === 'players_status' ||
      /^ngs_prospect_scores/.test(t) ||
      /combine|draft_profile|rookie/.test(t) ||
      t === 'pff_unresolved_players' ||
      t === 'nfl_coaches'
  ],
  // NFL game dimension (catches pff_game_id_map before the pff-* rule).
  ['nfl-games', (t) => /^nfl_game|game_id_map/.test(t)],
  // PFF NFL aggregate/charting tables (pff_* remainder after identity/games).
  ['pff-charting-nfl', (t) => /^pff_/.test(t)],
  // NFL fact families.
  [
    'nfl-plays-snaps',
    (t) =>
      /^nfl_plays|^nfl_snaps|^nfl_play_stats|^play_changelog|^personnel_count_discrepancies/.test(
        t
      )
  ],
  [
    'nfl-team-logs',
    (t) => /^nfl_team_(gamelogs|seasonlogs)|^nfl_matchup_stats/.test(t)
  ],
  [
    'nfl-player-logs',
    (t) =>
      /^player_(gamelogs|seasonlogs|careerlogs|passing_gamelogs|rushing_gamelogs|receiving_gamelogs|defender_gamelogs)/.test(
        t
      ) || /^scoring_format_player_/.test(t)
  ],
  // Betting / DFS markets.
  [
    'betting-props-timeseries',
    (t) =>
      /^prop|^betting|^odds|^market|_market_|book|sportsbook|^dfs|^draftkings|placed_wager|selection_combination|player_dfs/.test(
        t
      )
  ],
  // External snapshot/derived feeds -- injury/projections _index families are
  // snapshot/derived (finding 4), NOT the _history/_index temporal pair.
  [
    'external-feeds',
    (t) =>
      /^historical_injury|^footballoutsiders|^percentiles$|^sources$|projection|^ros_|correlation|outcome|player_variance/.test(
        t
      )
  ],
  // Genuine temporal feeds get the _history/_index time-series pair.
  [
    'rankings-adp-timeseries',
    (t) =>
      /_history$|_index$|^adp|^rankings|^dvoa|^espn|^ngs_|^keeptradecut|^ktc/.test(
        t
      ) &&
      // app job/import history is not a temporal data feed
      !/import_job|_job_history$/.test(t)
  ],
  // League application surface.
  [
    'league-app',
    (t) =>
      /^league|^team|^roster|^matchup|^transaction|^waiver|^poach|^trade|^user|^season|^draft$|^wager|^auction|^scoreboard|^lineup|^playoff|^schedule|^format|super_priority|^config$|^jobs$|^url|^invite|^external_league|^restricted_free_agency|^practice$|^worker_heartbeat$|^player_(contract|salar|team_extension)/.test(
        t
      )
  ]
]

function assign_cluster(table) {
  for (const [cluster, pred] of CLUSTER_RULES) {
    if (pred(table)) return cluster
  }
  return 'unclustered'
}

// --- consumer discovery (repo grep) ------------------------------------------

// Dirs whose files couple to physical table/column names. Excludes the schema
// dump itself, node_modules, git, and the LFS data submodule.
const CONSUMER_DIRS = [
  'libs-server',
  'libs-shared',
  'app',
  'server',
  'api',
  'jobs',
  'scripts',
  'db/adhoc',
  'db/migrations',
  'private'
]

// Redesign tooling that pattern-matches table names but is not a real consumer.
const TOOL_FILES = new Set([
  'db/adhoc/generate-migration-inventory.mjs',
  'db/adhoc/audit-schema-conformance.mjs',
  'db/adhoc/check-migration-coverage.mjs'
])

// One rg pass per table with a word boundary so `player` does not match
// `player_gamelogs` and `nfl_plays` does not match `nfl_plays_year_2020`
// (the trailing `_` blocks the boundary). Returns a sorted, repo-relative list.
function find_consumers(table) {
  const dirs = CONSUMER_DIRS.filter((d) =>
    fs.existsSync(path.join(repo_root, d))
  )
  if (!dirs.length) return []
  try {
    const out = execFileSync(
      'rg',
      ['-l', '--no-messages', `\\b${table}\\b`, ...dirs],
      { cwd: repo_root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
    return (
      out
        .split('\n')
        .filter(Boolean)
        // The redesign tooling itself contains table-name patterns (cluster
        // rules, allowlists); it is not a real consumer, and leaving it in would
        // make the coverage gate never clear after a rename.
        .filter((f) => !TOOL_FILES.has(f))
        .sort()
    )
  } catch (err) {
    // rg exits 1 when there are no matches -- that is a clean empty result.
    if (err.status === 1) return []
    throw err
  }
}

// --- build -------------------------------------------------------------------

function build_inventory({ with_consumers }) {
  const sql = fs.readFileSync(schema_path, 'utf8')
  const tables = fold_partitions(parse_schema(sql))
  const records = []
  for (const [table, meta] of [...tables].sort()) {
    records.push({
      current_table: table,
      domain_cluster: assign_cluster(table),
      column_count: meta.columns.length,
      partitions: meta.partitions || [],
      columns: meta.columns,
      consumer_files: with_consumers ? find_consumers(table) : null
    })
  }
  return records
}

function cluster_distribution(records) {
  const dist = new Map()
  for (const r of records) {
    dist.set(r.domain_cluster, (dist.get(r.domain_cluster) || 0) + 1)
  }
  return [...dist].sort((a, b) => b[1] - a[1])
}

function emit_trackers(records) {
  const progress_dir = path.join(scratch_dir, 'progress')
  fs.mkdirSync(progress_dir, { recursive: true })
  const by_cluster = new Map()
  for (const r of records) {
    if (!by_cluster.has(r.domain_cluster)) by_cluster.set(r.domain_cluster, [])
    by_cluster.get(r.domain_cluster).push(r)
  }
  for (const [cluster, rows] of by_cluster) {
    const file = path.join(progress_dir, `${cluster}.md`)
    if (fs.existsSync(file)) {
      // Never clobber a tracker a session may be mid-claim on. Regeneration
      // only stubs clusters that have no tracker yet.
      continue
    }
    const lines = [
      `# Cluster progress: ${cluster}`,
      '',
      '- Owning thread: (unclaimed)',
      '- State legend: todo -> in_progress -> in_review -> done',
      '',
      '| table | state | target table | notes |',
      '| --- | --- | --- | --- |'
    ]
    for (const r of rows.sort((a, b) =>
      a.current_table.localeCompare(b.current_table)
    )) {
      lines.push(`| ${r.current_table} | todo |  |  |`)
    }
    fs.writeFileSync(file, lines.join('\n') + '\n')
  }
  return [...by_cluster.keys()]
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('consumers', { type: 'boolean', default: true })
    .option('emit-trackers', { type: 'boolean', default: false })
    .option('summary', { type: 'boolean', default: false })
    .help().argv

  const records = build_inventory({ with_consumers: argv.consumers })
  const dist = cluster_distribution(records)

  console.log(`migration inventory -- ${records.length} logical tables`)
  console.log('cluster distribution:')
  for (const [cluster, n] of dist) {
    console.log(`  ${String(n).padStart(4)}  ${cluster}`)
  }
  const unclustered = records.filter((r) => r.domain_cluster === 'unclustered')
  if (unclustered.length) {
    console.log(
      `\n${unclustered.length} unclustered (need a rule or manual bucket):`
    )
    for (const r of unclustered) console.log(`  ${r.current_table}`)
  }

  if (argv.summary) return

  fs.mkdirSync(scratch_dir, { recursive: true })
  const out_path = path.join(scratch_dir, 'inventory.json')
  fs.writeFileSync(out_path, JSON.stringify(records, null, 2) + '\n')
  console.log(`\nwrote ${out_path}`)

  if (argv['emit-trackers']) {
    const clusters = emit_trackers(records)
    console.log(
      `stubbed ${clusters.length} cluster trackers under ${path.join(scratch_dir, 'progress')}`
    )
  }
}

main()
