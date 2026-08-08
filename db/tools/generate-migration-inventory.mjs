// Migration inventory generator for the league four-layer schema redesign.
//
// Enumerates every current table from db/schema.postgres.sql, attaches each
// table's columns, greps the repo for every file that references the table by
// name, and assigns exactly one domain cluster. The output is the anti-omission
// spine of the migration: completeness is by construction, not memory, and a
// branched session claims a whole cluster from it.
//
// The inventory is IMMUTABLE and REGENERABLE -- never hand-edit inventory.json;
// re-run this to refresh it. It carried a companion --emit-trackers mode that
// stubbed mutable per-cluster progress/<cluster>.md trackers; that substrate was
// retired on 2026-07-29 (see db/gates/check-dropped-table-consumers.mjs), and
// the conformance audit plus the task plan checkboxes carry cluster state now.
//
// Usage:
//   node db/tools/generate-migration-inventory.mjs                 # write inventory.json
//   node db/tools/generate-migration-inventory.mjs --no-consumers  # skip the repo grep (fast)
//   node db/tools/generate-migration-inventory.mjs --summary       # print cluster distribution only
//
// Output roots resolve to the user-base scratch slug when run inside user-base,
// else to a local ./scratch fallback for a standalone clone.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { parse_partition_map } from './schema-partitions.mjs'

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

// A partition child duplicates its parent's columns; fold it into the parent so
// the inventory records the logical table once and lists its children.
//
// Membership comes from the dump's ATTACH PARTITION lines, not from a name
// pattern. The previous `<base>_year_YYYY` regex folded only 81 of the 116
// children and left the other 27 standing as top-level inventory entries --
// seventeen `historical_injury_index_YYYY`, the eight `projections_index_y*`,
// and two `_default` catch-alls -- so a worker sizing a cluster from this file
// saw partitions of an already-listed table as separate migration targets.
function fold_partitions(tables, partition_map) {
  const children = new Set()
  for (const kids of partition_map.values()) {
    for (const kid of kids) children.add(kid)
  }

  const folded = new Map()
  for (const [table, columns] of tables) {
    if (children.has(table)) continue
    folded.set(table, { columns })
  }
  for (const [parent, kids] of partition_map) {
    if (folded.has(parent)) folded.get(parent).partitions = kids
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
  // NFL game dimension.
  ['nfl-games', (t) => /^nfl_game/.test(t)],
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
      /^historical_injury|^percentiles$|^sources$|projection|^ros_|correlation|outcome|player_variance/.test(
        t
      )
  ],
  // Genuine temporal feeds get the _history/_index time-series pair, with two
  // ratified exceptions that stay in this cluster because they ARE temporal
  // feeds: espn_receiving_metrics_history's sibling and keeptradecut_valuations,
  // whose only latest-read path is already an index-only scan that stops on the
  // first entry, so an _index would buy nothing.
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

// Redesign tooling pattern-matches table names (cluster rules, rename maps,
// allowlists) without being a real consumer, and leaving it in the result would
// make the coverage gate never clear after a rename. That used to need a
// hand-maintained TOOL_FILES exclusion naming three files, which is the shape
// that decays: a new gate is a new entry nobody remembers to add, and the
// omission reads as a consumer rather than as a miss.
//
// The 2026-08-06 db/ split removes the need for it. `db/gates`, `db/tools` and
// `db/archive` are simply NOT consumer directories, so the exclusion is now
// structural and the list is gone. Keep it that way: put new tooling in one of
// those three, never in a directory listed above.

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
    return out.split('\n').filter(Boolean).sort()
  } catch (err) {
    // rg exits 1 when there are no matches -- that is a clean empty result.
    if (err.status === 1) return []
    throw err
  }
}

// --- build -------------------------------------------------------------------

function build_inventory({ with_consumers }) {
  const sql = fs.readFileSync(schema_path, 'utf8')
  const tables = fold_partitions(parse_schema(sql), parse_partition_map(sql))
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

// The inventory is regenerable, but nothing was RE-running it, so it drifted
// silently: by 2026-07-31 it was missing 9 live tables and still listing 3 that
// had been dropped, while reading as authoritative to every worker sizing a
// cluster from it. Drift in an oracle is worse than absence, because absence is
// obvious. This mode makes it loud -- it compares the checked-in file against a
// fresh generation of the TABLE SET and exits non-zero on any difference.
//
// Deliberately compares table membership only, not the whole record. Column
// lists and the consumer grep shift with ordinary code edits, so a full-record
// comparison would fail constantly and get muted. Membership is the property the
// anti-omission role actually depends on: a cluster cannot be bounded from a file
// that does not know which tables exist.
function check_inventory(records) {
  const out_path = path.join(scratch_dir, 'inventory.json')
  if (!fs.existsSync(out_path)) {
    console.error(
      `inventory check -- ${out_path} does not exist; run without --check`
    )
    return 1
  }

  const on_disk = new Set(
    JSON.parse(fs.readFileSync(out_path, 'utf8')).map((r) => r.current_table)
  )
  const fresh = new Set(records.map((r) => r.current_table))
  const missing = [...fresh].filter((t) => !on_disk.has(t)).sort()
  const phantom = [...on_disk].filter((t) => !fresh.has(t)).sort()

  if (!missing.length && !phantom.length) {
    console.log(
      `inventory check -- ${fresh.size} logical tables, inventory.json is current.`
    )
    return 0
  }

  console.error('inventory check -- inventory.json is STALE:\n')
  for (const t of missing) {
    console.error(`  missing (live table not listed):        ${t}`)
  }
  for (const t of phantom) {
    console.error(`  phantom (dropped, or now a partition):  ${t}`)
  }
  console.error(
    '\nRegenerate with `node db/tools/generate-migration-inventory.mjs` and commit the result.'
  )
  return 1
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('consumers', { type: 'boolean', default: true })
    .option('summary', { type: 'boolean', default: false })
    .option('check', {
      type: 'boolean',
      default: false,
      description:
        'Fail if the checked-in inventory.json does not match the current schema'
    })
    .help().argv

  if (argv.check) {
    process.exitCode = check_inventory(
      build_inventory({ with_consumers: false })
    )
    return
  }

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
}

main()
