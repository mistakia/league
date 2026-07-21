// Player-column repoint / dangling-name gate for the identity-crosswalk cluster
// of the four-layer schema redesign (user:task/league/redesign-league-database-schema.md).
//
// The player cutover renamed 62 columns behind an updatable dual-name compat
// view `player` (old + new names both resolve). The CONTRACT phase (DROP VIEW +
// rename player_dimension -> player) may run ONLY once every consumer has been
// repointed off the old names. check-migration-coverage --check-dangling is
// blind to this: it re-greps the old *table* name, which is unchanged here, so
// it cannot see lingering old *column* names. This tool closes that gap.
//
// It scans consumer code for two high-confidence dangling patterns and gates on
// them, and surfaces a third (aliased) pattern as a review warning:
//   GATE   (player|players).<oldcol>            -- qualified raw-SQL access
//   GATE   column_name: '<oldcol>'              -- structured data-view defs
//   WARN   p.<oldcol>                           -- alias, usually player (confirm)
//
// `esbid` is dual-meaning: player.esbid is the Elias PLAYER id (-> esb_player_id),
// but the bare/aliased esbid is the retained canonical GAME key (unchanged). So
// esbid gates only on the fully-qualified player/players form and is excluded
// from the alias warning.
//
// Usage:
//   node db/adhoc/check-player-column-repoint.mjs            # full report
//   node db/adhoc/check-player-column-repoint.mjs --gate     # exit 1 if any GATE hit remains
//   node db/adhoc/check-player-column-repoint.mjs --column pos   # scope to one column
//   node db/adhoc/check-player-column-repoint.mjs --json     # machine-readable
//
// Exit 0 = no gated dangling references; 1 = gated references remain (or --gate
// with any); 2 = tooling error.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// The authoritative player old -> new column rename map, promoted out of the
// ephemeral scratch tracker (scratch/league/schema-redesign/player-column-mapping.md)
// to durable tooling. Matches the applied 2026-07-21-player-dimension-conform-expand.sql.
export const PLAYER_COLUMN_RENAMES = {
  fname: 'first_name',
  lname: 'last_name',
  pname: 'short_name',
  formatted: 'formatted_name',
  pos: 'primary_position',
  pos1: 'secondary_position',
  pos2: 'tertiary_position',
  posd: 'position_depth',
  height: 'height_inches',
  weight: 'weight_pounds',
  forty: 'forty_yard_dash_seconds',
  bench: 'bench_press_reps',
  vertical: 'vertical_jump_inches',
  broad: 'broad_jump_inches',
  shuttle: 'shuttle_run_seconds',
  cone: 'three_cone_drill_seconds',
  arm: 'arm_length_inches',
  hand: 'hand_size_inches',
  forty_designation: 'forty_yard_dash_designation',
  ten_yard_split: 'ten_yard_split_seconds',
  pro_forty: 'pro_day_forty_seconds',
  pro_forty_designation: 'pro_day_forty_designation',
  sixty_yard_shuttle: 'sixty_yard_shuttle_seconds',
  dpos: 'draft_overall_pick',
  round: 'draft_round',
  dcp: 'draft_capital_points',
  col: 'college',
  dv: 'college_division',
  dob: 'date_of_birth',
  jnum: 'jersey_number',
  nfl_id: 'nfl_player_id',
  esbid: 'esb_player_id',
  gsisid: 'gsis_player_id',
  gsispid: 'smart_player_id',
  gsis_it_id: 'gsis_it_player_id',
  sleeper_id: 'sleeper_player_id',
  rotoworld_id: 'rotoworld_player_id',
  rotowire_id: 'rotowire_player_id',
  sportradar_id: 'sportradar_player_id',
  espn_id: 'espn_player_id',
  fantasy_data_id: 'fantasy_data_player_id',
  yahoo_id: 'yahoo_player_id',
  keeptradecut_id: 'keeptradecut_player_id',
  pfr_id: 'pfr_player_id',
  otc_id: 'otc_player_id',
  pff_id: 'pff_player_id',
  mfl_id: 'mfl_player_id',
  fleaflicker_id: 'fleaflicker_player_id',
  cbs_id: 'cbs_player_id',
  cfbref_id: 'cfbref_player_id',
  swish_id: 'swish_player_id',
  draftkings_id: 'draftkings_player_id',
  fanduel_id: 'fanduel_player_id',
  rts_id: 'rts_player_id',
  sis_id: 'sis_player_id',
  sis_prospect_pos_rank: 'sis_prospect_position_rank',
  ffpc_id: 'ffpc_player_id',
  nffc_id: 'nffc_player_id',
  fantrax_id: 'fantrax_player_id',
  sumer_id: 'sumer_player_id',
  fantasylabs_id: 'fantasylabs_player_id',
  underdog_id: 'underdog_player_id'
}

// esbid is the retained game key when bare/aliased; only its player-qualified
// form is a dangling player-column reference.
const DUAL_MEANING_GAME_KEYS = new Set(['esbid'])

// Verified non-dangling sites: a `player.<oldcol>` match that is NOT a player
// dimension column read here, so it stays and must not gate the CONTRACT.
// `player.esbid` in the simulation path is the GAME key carried on an in-memory
// player-projection object (`game_environment` is `Map<esbid, {...}>`, looked up
// via `game_environment.get(player.esbid)`), not the player.esbid Elias id column
// that renamed to esb_player_id. Verified 2026-07-21 (JSDoc + game_environment
// usage in all four files).
const ACCEPTED_NON_DANGLING = {
  esbid: [
    'libs-server/simulation/simulate-nfl-game.mjs',
    'libs-shared/simulation/build-extended-correlation-matrix.mjs',
    'libs-shared/simulation/run-simulation.mjs',
    'libs-shared/simulation/apply-game-environment-adjustments.mjs'
  ]
}

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

// Parse `rg --vimgrep` lines: file:line:col:text
function parse_hits(lines) {
  return lines
    .map((line) => {
      const m = line.match(/^([^:]+):(\d+):(\d+):(.*)$/)
      if (!m) return null
      return { file: m[1], line: Number(m[2]), text: m[4].trim() }
    })
    .filter(Boolean)
}

function scan_column(old_col) {
  const dirs = SCAN_DIRS.filter((d) => fs.existsSync(path.join(repo_root, d)))
  // GATE 1: qualified raw-SQL access player.<col> / players.<col>
  const qualified = parse_hits(
    rg(['--vimgrep', '-e', `\\b(player|players)\\.${old_col}\\b`, ...dirs])
  )
  // GATE 2: structured data-view column definitions column_name: '<col>'
  const defs = fs.existsSync(path.join(repo_root, DEFINITIONS_DIR))
    ? parse_hits(
        rg([
          '--vimgrep',
          '-e',
          `column_name:\\s*['"]${old_col}['"]`,
          DEFINITIONS_DIR
        ])
      )
    : []
  // WARN: alias p.<col> (usually player; confirm). Skipped for game-key names.
  const aliased = DUAL_MEANING_GAME_KEYS.has(old_col)
    ? []
    : parse_hits(rg(['--vimgrep', '-e', `\\bp\\.${old_col}\\b`, ...dirs]))

  // Drop verified non-dangling sites (e.g. simulation player.esbid = game key).
  const accepted = new Set(ACCEPTED_NON_DANGLING[old_col] || [])
  const gate = [...qualified, ...defs].filter((h) => !accepted.has(h.file))

  return { gate, warn: aliased }
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('gate', { type: 'boolean', default: false })
    .option('column', { type: 'string' })
    .option('json', { type: 'boolean', default: false })
    .strict(false)
    .parse()

  const columns = argv.column
    ? [argv.column]
    : Object.keys(PLAYER_COLUMN_RENAMES)

  if (argv.column && !PLAYER_COLUMN_RENAMES[argv.column]) {
    console.error(`unknown player column: ${argv.column}`)
    process.exitCode = 2
    return
  }

  const results = {}
  let gate_total = 0
  let warn_total = 0
  for (const old_col of columns) {
    const { gate, warn } = scan_column(old_col)
    if (gate.length || warn.length) {
      results[old_col] = { new: PLAYER_COLUMN_RENAMES[old_col], gate, warn }
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
      `\n${gate_total} gated dangling reference(s), ${warn_total} alias warning(s) across ${
        Object.keys(results).length
      } column(s)`
    )
  }

  if (gate_total > 0) {
    if (!argv.json)
      console.log(
        '\nGATE FAIL: old player column names still referenced -- repoint before CONTRACT.'
      )
    process.exitCode = 1
  } else if (!argv.json) {
    console.log(
      '\nGATE OK: no qualified/structured old player column references remain.'
    )
  }
}

// Lightweight is-main (avoids importing #libs-server, which pulls in config and
// requires NODE_ENV) so the rename map above can be imported by transform tools.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
