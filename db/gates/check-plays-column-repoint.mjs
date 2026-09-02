// Plays/snaps column-repoint / dangling-name gate for the nfl-plays-snaps cluster
// of the four-layer schema redesign (user:task/league/redesign-league-database-schema.md).
//
// This cluster renames columns on the NFL plays/snaps fact family
// (nfl_plays [+27 nfl_plays_year_* partitions], nfl_plays_current_week,
// nfl_plays_passer/receiver/rusher/player, nfl_snaps [+28 partitions],
// nfl_play_stats, nfl_play_stats_current_week) as a single ATOMIC metadata rename
// + lockstep code deploy (NO compat view — a partitioned parent cannot host an
// updatable INSTEAD-OF facade). So every consumer must be repointed before the
// cutover; there is no dual-name grace window.
//
// TOKEN AMBIGUITY is the crux of this cluster. The rename map splits into:
//   UNAMBIGUOUS tokens (essentially always our column): playId, seas_type,
//     pos_team, pos_team_id, bc_pid, psr_pid, trg_pid, intp_pid, clubCode,
//     playerName, statId, gsispid, teamid. These GATE on qualified/structured refs.
//   SHARED tokens (common English / other tables' columns): year, off, def, int,
//     to, desc, timestamp, position, gsis_id, fuml. A textual scan cannot safely
//     decide these, so they are WARN-only here; correctness for them rests on the
//     post-rename full mocha suite (the real gate) + opus review + the per-surface
//     discovery reports (scratch/league/schema-redesign/progress/nfl-plays-snaps-*).
//
// FEED-vs-COLUMN discipline: several old tokens (playId, year, gsis_id, clubCode,
// gsisId, statId, playerName) are ALSO raw nflverse / NGS / sportradar / NFL-API
// feed keys that MUST NOT be renamed. Verified feed sites are allowlisted below.
//
// BLIND SPOTS -- a FLOOR, not the gate. Blind to Knex object-shorthand
// (db('nfl_plays').where({ off })), bare column-string arrays (.select(['off',...])),
// bare row-var reads (row.off), and frontend Immutable .get()/accessorKey reads.
// The REAL gate is the full mocha suite against a post-rename candidate schema
// (LEAGUE_SCHEMA_FILE) plus opus review.
//
// Usage:
//   node db/gates/check-plays-column-repoint.mjs           # full report
//   node db/gates/check-plays-column-repoint.mjs --gate     # exit 1 if any GATE hit remains
//   node db/gates/check-plays-column-repoint.mjs --column playId
//   node db/gates/check-plays-column-repoint.mjs --json
//   node db/gates/check-plays-column-repoint.mjs --map <file>   # another cluster
// Exit 0 = no gated dangling refs; 1 = gated refs remain; 2 = tooling error.
//
// --map takes a JSON file shaped
//   { renames: [{ table, old_name, new_name }, ...], shared_tokens?: [...] }
// and REPLACES the built-in map below, so the same two gates serve any cluster
// renaming columns. Without --map the built-in nfl-plays-snaps map is used,
// which is what every existing invocation expects.
//
// THE ANCHOR IS DERIVED, NOT CONSTANT. This gate anchors a ref by table name,
// and it used to anchor every run on a hardcoded nine-table plays/snaps family
// regardless of --map. That made the gate report a FLOOR rather than a result
// for any cluster renaming outside those nine: with no anchor, its renames could
// not fail the gate (the boolean-prefix cluster ran with 129 of 249 renames
// invisible and exited 0 throughout), and where the nine happened to carry a
// column of the same name it reported THOSE hits against the map's table --
// two maps differing only in `table` produced byte-identical output.
//
// The anchored family now comes from the map's own `table` fields, and the
// SHARED-token set is derived from db/schema.postgres.sql rather than guessed:
// a token is shared exactly when some table OUTSIDE the anchored family also
// carries a column of that name, which is the condition that makes a textual
// scan unable to decide it. A map's declared shared_tokens stay a floor.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from './scan-corpus.mjs'
import { format_negative_controls } from './negative-control.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// Authoritative old -> new rename map for this cluster (matches
// 2026-07-24-conform-nfl-plays-snaps.sql).
export const PLAYS_COLUMN_RENAMES = {
  // core plays (nfl_plays + nfl_plays_current_week)
  playId: 'play_id',
  year: 'season_year',
  seas_type: 'season_type',
  desc: 'play_description',
  int: 'interceptions',
  to: 'timeouts',
  to_team: 'timeout_team',
  timestamp: 'play_time_of_day',
  off: 'offense_nfl_team',
  def: 'defense_nfl_team',
  pos_team: 'possession_nfl_team',
  pos_team_id: 'possession_nfl_team_id',
  bc_pid: 'ball_carrier_pid',
  psr_pid: 'passer_pid',
  trg_pid: 'target_pid',
  intp_pid: 'interceptor_pid',
  fuml: 'fumbles_lost',
  // participants (passer/receiver/rusher/player) + nfl_plays_player.position
  gsis_id: 'gsis_player_id',
  position: 'player_position',
  // nfl_play_stats / _current_week
  clubCode: 'nfl_team',
  playerName: 'player_name',
  statId: 'stat_id',
  gsisId: 'gsis_player_id',
  gsispid: 'smart_player_id',
  teamid: 'nfl_team_id'
}

// Tokens common enough (English words / other tables' columns) that a textual scan
// cannot decide them -- WARN-only, deferred to the mocha+opus+discovery gate.
const SHARED_TOKENS = new Set([
  'year',
  'off',
  'def',
  'int',
  'to',
  'desc',
  'timestamp',
  'position',
  'gsis_id',
  'fuml'
])

// Verified feed-key / non-column sites: a match that is a raw upstream feed key or
// an unrelated column, so it stays. Populated from the discovery reports.
// { oldToken: [file substrings...] }
const ACCEPTED_SITES = {
  // core-play-columns.mjs `column_name: 'timestamp'` belongs to
  // play_game_timestamp, which reads nfl_games."timestamp" -- a different table
  // that this cluster never touched and that is still an unconformed epoch
  // integer awaiting its own cluster. The adjacent play_timestamp definition
  // already reads the renamed nfl_plays.play_time_of_day. Repointing this site
  // at play_time_of_day would be a live defect, not a fix.
  timestamp: ['libs-server/plays-view/column-definitions/core-play-columns.mjs']
}

const SCAN_DIRS = [
  'libs-server',
  'libs-shared',
  'app',
  'server',
  'api',
  'jobs',
  'scripts',
  'private'
]

const DEFINITION_DIRS = [
  'libs-server/data-views-column-definitions',
  'libs-server/plays-view/column-definitions'
]

function rg(args) {
  try {
    const out = execFileSync('rg', ['--no-messages', ...args], {
      cwd: repo_root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024
    })
    return out.split('\n').filter(Boolean)
  } catch (err) {
    if (err.status === 1) return []
    throw err
  }
}

function parse_hits(lines) {
  return (
    lines
      .map((line) => {
        const m = line.match(/^([^:]+):(\d+):(\d+):(.*)$/)
        if (!m) return null
        return { file: m[1], line: Number(m[2]), text: m[4].trim() }
      })
      .filter(Boolean)
      // Prose comment lines are documentation, not code refs (they legitimately
      // cite the old name to explain the migration) -- do not gate on them.
      .filter((h) => !/^(\/\/|\*|\/\*)/.test(h.text))
  )
}

// The tables the BUILT-IN nfl-plays-snaps map renames on. This is the anchored
// family for that cluster only; it is NOT the anchor for a --map run, which
// derives its own from the map's own `table` fields. See derive_anchor_tables.
export const PLAYS_ANCHOR_TABLES = [
  'nfl_plays',
  'nfl_plays_current_week',
  'nfl_plays_passer',
  'nfl_plays_receiver',
  'nfl_plays_rusher',
  'nfl_plays_player',
  'nfl_snaps',
  'nfl_play_stats',
  'nfl_play_stats_current_week'
]

const escape_re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The regex alternation that anchors a ref to the cluster's own family.
// Longest-first so a prefix table (nfl_plays) cannot shadow a longer sibling
// (nfl_plays_current_week) in an alternation the engine evaluates left to right.
function table_alternation(tables) {
  const sorted = [...new Set(tables)].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  )
  return `(${sorted.map(escape_re).join('|')})`
}

// The anchored family for a run: the tables the MAP itself renames on. Anchoring
// a --map run on the built-in nine was the defect this replaces -- a cluster
// renaming outside those nine had no anchor, so the gate either reported zero
// (silent under-report) or, worse, reported the nine tables' own hits on a
// column the map never claimed on them (misattribution: two maps differing only
// in `table` produced byte-identical output).
function derive_anchor_tables(map_tables) {
  return map_tables.length ? map_tables : PLAYS_ANCHOR_TABLES
}

// --- shared-token derivation -------------------------------------------------

// A token is SHARED when the schema itself says a textual scan cannot decide it:
// some table OUTSIDE the anchored family also carries a column of that name, so
// a `column_name: '<col>'` definition in a multi-table definition dir could
// belong to either. Derived from db/schema.postgres.sql -- the tracked export IS
// this repo's information_schema of record, and reading it keeps the gate
// runnable with no database, which every other gate here relies on.
//
// Partition children (CREATE TABLE ... PARTITION OF ...) carry no column list in
// the export; their parent carries the columns, so they neither add nor hide a
// name here.
function parse_schema_columns(schema_path) {
  const sql = fs.readFileSync(schema_path, 'utf8')
  const by_column = new Map()
  const create_re = /^CREATE TABLE (?:public\.)?("?[A-Za-z0-9_]+"?)\s*\(\s*$/
  let current = null

  for (const raw of sql.split('\n')) {
    if (current === null) {
      const m = raw.match(create_re)
      if (m) current = m[1].replace(/"/g, '')
      continue
    }
    const trimmed = raw.trim()
    if (trimmed === ')' || /^\);/.test(trimmed)) {
      current = null
      continue
    }
    const col = trimmed.match(/^("?[A-Za-z0-9_]+"?)\s+\S/)
    if (!col) continue
    const name = col[1].replace(/"/g, '')
    if (!by_column.has(name)) by_column.set(name, new Set())
    by_column.get(name).add(current)
  }

  return by_column
}

function derive_shared_tokens({ anchor_tables, old_names, schema_path }) {
  const anchored = new Set(anchor_tables)
  const by_column = parse_schema_columns(schema_path)
  const derived = new Set()
  for (const name of old_names) {
    const carriers = by_column.get(name)
    if (!carriers) continue
    for (const table of carriers) {
      if (!anchored.has(table)) {
        derived.add(name)
        break
      }
    }
  }
  return derived
}

// Resolved ONCE rather than per column, so the corpus this gate actually read
// is a property of the run and not of whichever column happened to be scanned
// first. existsSync was the wrong oracle here: an uninitialized submodule is a
// present, EMPTY directory, so `private` passed the filter and contributed
// nothing.
const corpus = resolve_corpus({ roots: SCAN_DIRS, repo_root })

function scan_column(old_col, { anchor, shared_tokens }) {
  const dirs = corpus.present
  const esc = escape_re(old_col)

  // GATE 1: table-qualified raw SQL  <anchored_table>.<col>
  const qualified = parse_hits(
    rg(['--vimgrep', '-e', `\\b${anchor}\\.${esc}\\b`, ...dirs])
  )
  // GATE 2: structured data-view column defs  column_name: '<col>'  (plays defs only)
  const defs = DEFINITION_DIRS.filter((d) =>
    fs.existsSync(path.join(repo_root, d))
  ).flatMap((d) =>
    parse_hits(rg(['--vimgrep', '-e', `column_name:\\s*['"]${esc}['"]`, d]))
  )

  const accepted = ACCEPTED_SITES[old_col] || []
  const is_accepted = (h) => accepted.some((s) => h.file.includes(s))
  const is_shared = shared_tokens.has(old_col)
  // Table-qualified refs (<plays_table>.<col>) are anchored by the table name, so
  // they GATE for ALL tokens. The column_name: def pattern lives in a multi-table
  // definition dir, so for SHARED tokens it is WARN-only (could be another table's
  // column); for unambiguous tokens it GATEs.
  const gate = qualified.filter((h) => !is_accepted(h))
  const def_gate = is_shared ? [] : defs.filter((h) => !is_accepted(h))
  const warn = is_shared ? defs.filter((h) => !is_accepted(h)) : []
  return { gate: [...gate, ...def_gate], warn }
}

// One scan pass over a whole rename map, so a caller (main, or the negative
// control) can run the SAME machinery under a different anchor and compare.
function scan_map({ rename_map, anchor_tables, shared_tokens, columns }) {
  const anchor = table_alternation(anchor_tables)
  const results = {}
  let gate_total = 0
  let warn_total = 0
  for (const old_col of columns) {
    const { gate, warn } = scan_column(old_col, { anchor, shared_tokens })
    if (gate.length || warn.length) {
      results[old_col] = { new: rename_map[old_col], gate, warn }
      gate_total += gate.length
      warn_total += warn.length
    }
  }
  return { results, gate_total, warn_total }
}

// Loads a cluster rename map from disk, replacing the built-in one. Two old
// names on different tables may share a new name, and a plays-family rename is
// routinely applied to both nfl_plays and its current-week mirror, so the map
// is collapsed by OLD name -- the scan is textual and cannot distinguish the
// two tables anyway.
function load_map(map_path) {
  const raw = JSON.parse(fs.readFileSync(map_path, 'utf8'))
  const renames = {}
  const tables = []
  for (const { table, old_name, new_name } of raw.renames) {
    renames[old_name] = new_name
    if (table) tables.push(table)
  }
  return {
    renames,
    tables: [...new Set(tables)],
    shared_tokens: new Set(raw.shared_tokens || [])
  }
}

// The always-on control. It perturbs the ANCHOR -- the thing this gate's repair
// changed -- inside the window the gate measures, and requires the two readings
// to DIFFER. Asserting only that the run completed, or perturbing a table the
// scan never anchors on, yields a control that looks like it fired and proves
// nothing.
//
// The fixture is a table OUTSIDE the built-in nine carrying a column that other
// tables also carry, which is precisely the shape the old hardcoded anchor got
// wrong. Its first assertion is that the fixture MATCHES AT ALL under the
// derived anchor: a fixture whose refs have since been repointed would report a
// confident zero under both anchors, and a control that cannot match is vacuous.
const CONTROL_FIXTURE = {
  table: 'player_gamelogs',
  column: 'esbid'
}

function run_negative_control() {
  const { table, column } = CONTROL_FIXTURE
  const rename_map = { [column]: `${column}_control_target` }
  const columns = [column]
  const shared_tokens = new Set()

  // Derived anchor: the map's own table. This is what the repair introduced.
  const derived = scan_map({
    rename_map,
    anchor_tables: [table],
    shared_tokens,
    columns
  })
  // Unperturbed control: the old hardcoded nine-table anchor, which does not
  // contain the fixture's table.
  const hardcoded = scan_map({
    rename_map,
    anchor_tables: PLAYS_ANCHOR_TABLES,
    shared_tokens,
    columns
  })

  const fixture_matched = derived.gate_total > 0
  const anchors_differ = derived.gate_total !== hardcoded.gate_total

  const derived_files = new Set(
    (derived.results[column]?.gate || []).map((h) => `${h.file}:${h.line}`)
  )
  const hardcoded_files = new Set(
    (hardcoded.results[column]?.gate || []).map((h) => `${h.file}:${h.line}`)
  )
  const sites_differ =
    [...derived_files].some((f) => !hardcoded_files.has(f)) ||
    [...hardcoded_files].some((f) => !derived_files.has(f))

  return {
    fixture: `${table}.${column}`,
    derived_gate_total: derived.gate_total,
    hardcoded_gate_total: hardcoded.gate_total,
    controls: [
      {
        name: `fixture ${table}.${column} matches under the map-derived anchor (${derived.gate_total} hit(s)) -- a fixture that cannot match makes the control vacuous`,
        went_red: fixture_matched
      },
      {
        name: `map-derived anchor and the old nine-table anchor report DIFFERENT totals (${derived.gate_total} vs ${hardcoded.gate_total}) on a table outside the nine`,
        went_red: anchors_differ
      },
      {
        name: 'the two anchors report DIFFERENT sites, not merely different counts',
        went_red: sites_differ
      }
    ]
  }
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('gate', { type: 'boolean', default: false })
    .option('column', { type: 'string' })
    .option('json', { type: 'boolean', default: false })
    .option('map', { type: 'string' })
    .strict(false)
    .parse()

  let rename_map = PLAYS_COLUMN_RENAMES
  let anchor_tables = PLAYS_ANCHOR_TABLES
  let declared_shared = SHARED_TOKENS
  if (argv.map) {
    try {
      const loaded = load_map(argv.map)
      rename_map = loaded.renames
      anchor_tables = derive_anchor_tables(loaded.tables)
      // Replace rather than merge: a token this cluster treats as decidable
      // must not stay WARN-only because a previous cluster could not decide it.
      declared_shared = loaded.shared_tokens
    } catch (error) {
      console.error(`could not read --map ${argv.map}: ${error.message}`)
      process.exitCode = 2
      return
    }
  }

  const columns = argv.column ? [argv.column] : Object.keys(rename_map)

  if (argv.column && !rename_map[argv.column]) {
    console.error(`unknown plays column: ${argv.column}`)
    process.exitCode = 2
    return
  }

  // Declared tokens are a FLOOR, not the answer: the schema can prove a token is
  // shared that the map never declared, and it must not silently un-share one a
  // cluster deliberately declared undecidable.
  const shared_tokens = new Set(declared_shared)
  let derived_shared = []
  try {
    derived_shared = [
      ...derive_shared_tokens({
        anchor_tables,
        old_names: Object.keys(rename_map),
        schema_path: path.join(repo_root, 'db', 'schema.postgres.sql')
      })
    ]
    for (const t of derived_shared) shared_tokens.add(t)
  } catch (error) {
    console.error(
      `could not derive shared tokens from the schema export: ${error.message}`
    )
    process.exitCode = 2
    return
  }

  const { results, gate_total, warn_total } = scan_map({
    rename_map,
    anchor_tables,
    shared_tokens,
    columns
  })

  const control = run_negative_control()
  const control_ok = control.controls.every((c) => c.went_red)

  if (argv.json) {
    console.log(
      JSON.stringify(
        {
          gate_total,
          warn_total,
          anchor_tables,
          shared_tokens: [...shared_tokens].sort(),
          derived_shared_tokens: derived_shared.sort(),
          negative_control: control,
          corpus,
          results
        },
        null,
        2
      )
    )
  } else {
    console.log(format_corpus({ corpus }))
    console.log(
      `anchored family (${anchor_tables.length}): ${anchor_tables.join(', ')}`
    )
    console.log(
      `shared tokens: ${[...shared_tokens].sort().join(', ') || '(none)'}` +
        ` -- ${derived_shared.length} derived from the schema export`
    )
    console.log('')

    for (const [old_col, { new: new_col, gate, warn }] of Object.entries(
      results
    )) {
      console.log(
        `\n${old_col} -> ${new_col}  (${gate.length} gate, ${warn.length} warn)`
      )
      for (const h of gate) console.log(`  GATE ${h.file}:${h.line}  ${h.text}`)
      for (const h of warn) console.log(`  warn ${h.file}:${h.line}  ${h.text}`)
    }
    console.log(
      `\n${gate_total} gated dangling reference(s), ${warn_total} warn(s).`
    )
    console.log('')
    console.log(format_negative_controls({ controls: control.controls }))
  }

  if (gate_total > 0) {
    if (!argv.json)
      console.log(
        '\nGATE FAIL: old plays/snaps column names still referenced -- repoint before cutover.'
      )
    process.exitCode = 1
  } else if (!control_ok) {
    if (!argv.json)
      console.log(
        '\nGATE FAIL: the negative control did not fire, so this run reports nothing. A zero from a gate that cannot be made to differ is not evidence.'
      )
    process.exitCode = 1
  } else if (!argv.json) {
    console.log(
      `\nGATE OK: no qualified/structured unambiguous old refs remain.${verdict_suffix(corpus)}`
    )
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
