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
//   node db/adhoc/check-plays-column-repoint.mjs           # full report
//   node db/adhoc/check-plays-column-repoint.mjs --gate     # exit 1 if any GATE hit remains
//   node db/adhoc/check-plays-column-repoint.mjs --column playId
//   node db/adhoc/check-plays-column-repoint.mjs --json
//   node db/adhoc/check-plays-column-repoint.mjs --map <file>   # another cluster
// Exit 0 = no gated dangling refs; 1 = gated refs remain; 2 = tooling error.
//
// --map takes a JSON file shaped
//   { renames: [{ table, old_name, new_name }, ...], shared_tokens?: [...] }
// and REPLACES the built-in map below, so the same two gates serve any cluster
// renaming columns on the plays family. Only the map is cluster-specific; the
// anchor tables, scan dirs and matchers are not. Without --map the built-in
// nfl-plays-snaps map is used, which is what every existing invocation expects.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

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

// Table aliases / names that anchor a ref to the plays/snaps family.
const PLAYS_TABLES =
  '(nfl_plays|nfl_plays_current_week|nfl_plays_passer|nfl_plays_receiver|nfl_plays_rusher|nfl_plays_player|nfl_snaps|nfl_play_stats|nfl_play_stats_current_week)'

function scan_column(old_col) {
  const dirs = SCAN_DIRS.filter((d) => fs.existsSync(path.join(repo_root, d)))
  const esc = old_col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // GATE 1: table-qualified raw SQL  <plays_table>.<col>
  const qualified = parse_hits(
    rg(['--vimgrep', '-e', `\\b${PLAYS_TABLES}\\.${esc}\\b`, ...dirs])
  )
  // GATE 2: structured data-view column defs  column_name: '<col>'  (plays defs only)
  const defs = DEFINITION_DIRS.filter((d) =>
    fs.existsSync(path.join(repo_root, d))
  ).flatMap((d) =>
    parse_hits(rg(['--vimgrep', '-e', `column_name:\\s*['"]${esc}['"]`, d]))
  )

  const accepted = ACCEPTED_SITES[old_col] || []
  const is_accepted = (h) => accepted.some((s) => h.file.includes(s))
  // Table-qualified refs (<plays_table>.<col>) are anchored by the table name, so
  // they GATE for ALL tokens. The column_name: def pattern lives in a multi-table
  // definition dir, so for SHARED tokens it is WARN-only (could be another table's
  // column); for unambiguous tokens it GATEs.
  const gate = qualified.filter((h) => !is_accepted(h))
  const def_gate = SHARED_TOKENS.has(old_col)
    ? []
    : defs.filter((h) => !is_accepted(h))
  const warn = SHARED_TOKENS.has(old_col)
    ? defs.filter((h) => !is_accepted(h))
    : []
  return { gate: [...gate, ...def_gate], warn }
}

// Loads a cluster rename map from disk, replacing the built-in one. Two old
// names on different tables may share a new name, and a plays-family rename is
// routinely applied to both nfl_plays and its current-week mirror, so the map
// is collapsed by OLD name -- the scan is textual and cannot distinguish the
// two tables anyway.
function load_map(map_path) {
  const raw = JSON.parse(fs.readFileSync(map_path, 'utf8'))
  const renames = {}
  for (const { old_name, new_name } of raw.renames) renames[old_name] = new_name
  return { renames, shared_tokens: new Set(raw.shared_tokens || []) }
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
  if (argv.map) {
    try {
      const loaded = load_map(argv.map)
      rename_map = loaded.renames
      // Replace rather than merge: a token this cluster treats as decidable
      // must not stay WARN-only because a previous cluster could not decide it.
      SHARED_TOKENS.clear()
      for (const t of loaded.shared_tokens) SHARED_TOKENS.add(t)
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

  const results = {}
  let gate_total = 0
  let warn_total = 0
  for (const old_col of columns) {
    const { gate, warn } = scan_column(old_col)
    if (gate.length || warn.length) {
      results[old_col] = { new: rename_map[old_col], gate, warn }
      gate_total += gate.length
      warn_total += warn.length
    }
  }

  if (argv.json) {
    console.log(JSON.stringify({ gate_total, warn_total, results }, null, 2))
  } else {
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
  }

  if (gate_total > 0) {
    if (!argv.json)
      console.log(
        '\nGATE FAIL: old plays/snaps column names still referenced -- repoint before cutover.'
      )
    process.exitCode = 1
  } else if (!argv.json) {
    console.log(
      '\nGATE OK: no qualified/structured unambiguous old refs remain.'
    )
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
