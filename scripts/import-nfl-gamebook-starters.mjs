/**
 * Import NFL Gamebook Starters
 *
 * Parses cached NFL gamebook PDFs (see scripts/archive-nfl-gamebooks.mjs) and
 * writes the 44 declared starters per game to player_gamelogs.started.
 *
 * Resolution path: PDF (team, jersey) -> nflverse weekly_rosters CSV
 * (team, week, jersey_number) -> gsis_id -> player.gsisid -> pid.
 *
 * After upserting the 44 started=true rows for an esbid, sweeps the rest of
 * the dressed roster to started=false (active IS TRUE OR active IS NULL --
 * the IS NULL clause covers 2002-2014 rows from the legacy importer era when
 * `active` was not always populated).
 *
 * Usage:
 *   node scripts/import-nfl-gamebook-starters.mjs --year 2024
 *   node scripts/import-nfl-gamebook-starters.mjs --start_year 2002 --end_year 2025
 *   node scripts/import-nfl-gamebook-starters.mjs --year 2024 --week 1
 *   node scripts/import-nfl-gamebook-starters.mjs --year 2024 --force_download
 */

import debug from 'debug'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { pipeline } from 'stream'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  report_job,
  fetch_with_retry,
  throw_if_shortfall,
  readCSV
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('import-nfl-gamebook-starters')
debug.enable('import-nfl-gamebook-starters')

const stream_pipeline = promisify(pipeline)
const RESOLUTION_FLOOR_PER_GAME = 0.95

// Same alias map as scripts/import-nflverse-weekly-rosters.mjs -- pre-normalise
// historical nflverse codes that fixTeam doesn't recognise.
const NFLVERSE_TEAM_ALIASES = {
  SL: 'STL',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  ARZ: 'ARI'
}

// Map gamebook PDF team labels -> league abbreviations. Includes historical
// franchise names for the 2002-2025 backfill window.
const TEAM_LABEL_TO_ABBR = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Los Angeles Rams': 'LA',
  'St. Louis Rams': 'LA',
  'Los Angeles Chargers': 'LAC',
  'San Diego Chargers': 'LAC',
  'Las Vegas Raiders': 'LV',
  'Oakland Raiders': 'LV',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'Seattle Seahawks': 'SEA',
  'San Francisco 49ers': 'SF',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Houston Oilers': 'TEN',
  'Tennessee Oilers': 'TEN',
  'Washington Commanders': 'WAS',
  'Washington Football Team': 'WAS',
  'Washington Redskins': 'WAS'
}

const POSITION_ALIAS = {
  LDE: 'DE',
  RDE: 'DE',
  LDT: 'DT',
  RDT: 'DT',
  NT: 'DT',
  SS: 'S',
  FS: 'S',
  LCB: 'CB',
  RCB: 'CB',
  LOLB: 'OLB',
  ROLB: 'OLB',
  LILB: 'ILB',
  RILB: 'ILB',
  LB: 'LB',
  T: 'T',
  LT: 'T',
  RT: 'T',
  G: 'G',
  LG: 'G',
  RG: 'G'
}

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('week', { type: 'number' })
    .option('seas_type', { type: 'string' })
    .option('force_download', { type: 'boolean', default: false })
    .option('dry_run', { type: 'boolean', default: false }).argv

const cache_path_for = (esbid) =>
  path.join(os.homedir(), 'cache/nfl/gamebook', `${esbid}.pdf`)

const release_url_for_year = (year) =>
  `https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_${year}.csv`

const download_csv = async ({ year, force_download = false }) => {
  const file_path = path.join(os.tmpdir(), `nflverse_roster_weekly_${year}.csv`)
  if (force_download || !fs.existsSync(file_path)) {
    log(`downloading ${release_url_for_year(year)}`)
    const response = await fetch_with_retry({ url: release_url_for_year(year) })
    if (!response.ok) {
      throw new Error(
        `nflverse weekly_rosters download failed for ${year}: ${response.status} ${response.statusText}`
      )
    }
    await stream_pipeline(response.body, fs.createWriteStream(file_path))
  }
  return file_path
}

const pdftotext = (pdf_path) =>
  new Promise((resolve, reject) => {
    const proc = spawn('pdftotext', ['-layout', pdf_path, '-'])
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => (stdout += d.toString()))
    proc.stderr.on('data', (d) => (stderr += d.toString()))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pdftotext exit ${code}: ${stderr}`))
      } else {
        resolve(stdout)
      }
    })
  })

const normalize_position = (label) => POSITION_ALIAS[label] || label

// A starter row looks like (with arbitrary leading whitespace):
//   "      WR    19 C.Austin"
// Returns { pos, jnum, name } or null.
const STARTER_ROW = /^\s*([A-Z]{1,5})\s+(\d{1,2})\s+(\S.*?)\s*$/

const parse_gamebook_lineups = async ({ pdf_path }) => {
  const text = await pdftotext(pdf_path)
  const lines = text.split('\n')

  const lineups_idx = lines.findIndex((l) => /^\s*Lineups\s*$/.test(l))
  if (lineups_idx === -1) throw new Error('Lineups header not found')
  // Find the next Substitutions line after Lineups.
  const subs_offset = lines
    .slice(lineups_idx + 1)
    .findIndex((l) => /Substitutions/.test(l))
  if (subs_offset === -1) throw new Error('Substitutions footer not found')
  const subs_idx = lineups_idx + 1 + subs_offset

  // Within the block, the team-name line is the first non-empty line after
  // "Lineups", and the Offense/Defense header is the next non-empty line.
  const block = lines.slice(lineups_idx + 1, subs_idx)
  const non_empty = block.filter((l) => l.trim().length)
  if (non_empty.length < 3) throw new Error('Lineups block too short')

  const teams_line = non_empty[0]
  const header_line = non_empty[1]
  const row_lines = non_empty.slice(2)

  // The header line has 4 column tokens: Offense Defense Offense Defense.
  // Use their character positions as column boundaries.
  const header_positions = []
  let search_from = 0
  for (const token of ['Offense', 'Defense', 'Offense', 'Defense']) {
    const idx = header_line.indexOf(token, search_from)
    if (idx === -1) throw new Error(`header token ${token} not found`)
    header_positions.push(idx)
    search_from = idx + token.length
  }
  // Column boundaries: midpoints between consecutive header positions.
  const col_boundaries = []
  for (let i = 1; i < header_positions.length; i++) {
    col_boundaries.push((header_positions[i - 1] + header_positions[i]) / 2)
  }

  // Parse the team labels: find both team-name strings in teams_line, classify
  // each row's column position into one of the 4 quadrants.
  const team_labels_found = []
  for (const [label, abbr] of Object.entries(TEAM_LABEL_TO_ABBR)) {
    const idx = teams_line.indexOf(label)
    if (idx !== -1) team_labels_found.push({ abbr, idx, label })
  }
  // Sort by position; expect exactly 2.
  team_labels_found.sort((a, b) => a.idx - b.idx)
  if (team_labels_found.length < 2) {
    throw new Error(
      `expected 2 team labels in "${teams_line.trim()}", got ${team_labels_found.length}`
    )
  }
  const [left_team, right_team] = team_labels_found

  // Collect 4 quadrants of 11 rows.
  const quadrants = [[], [], [], []]
  for (const line of row_lines) {
    // Split into segments by column. Each row has up to 4 starter entries.
    const segments = [
      line.slice(0, col_boundaries[0]),
      line.slice(col_boundaries[0], col_boundaries[1]),
      line.slice(col_boundaries[1], col_boundaries[2]),
      line.slice(col_boundaries[2])
    ]
    for (let i = 0; i < 4; i++) {
      const seg = segments[i]
      const m = seg.match(STARTER_ROW)
      if (!m) continue
      const [, pos, jnum, name] = m
      quadrants[i].push({
        pos: normalize_position(pos),
        jnum: Number(jnum),
        name: name.trim()
      })
    }
  }

  // Quadrant row count is usually 11. Edge cases:
  //   - 10 or 12 in modern gamebooks (jumbo packages, occasional FB variance)
  //   - 20-22 in 2003-era PDFs where the defensive lineup is listed both
  //     interleaved with offense and as a separate continuation block.
  //     dedup-by-pid downstream collapses the duplicates.
  // Anything under 9 or over 24 indicates a real parse error.
  for (let i = 0; i < 4; i++) {
    if (quadrants[i].length < 9 || quadrants[i].length > 24) {
      throw new Error(
        `quadrant ${i} has ${quadrants[i].length} rows, expected 9-24`
      )
    }
  }

  return {
    left: {
      abbr: left_team.abbr,
      offense: quadrants[0],
      defense: quadrants[1]
    },
    right: {
      abbr: right_team.abbr,
      offense: quadrants[2],
      defense: quadrants[3]
    }
  }
}

const last_name_of = (name) => {
  // "D.Robinson" -> "robinson"; "Mi.Thomas" -> "thomas"; "Pierre-Paul" -> "pierre-paul"
  const dot = name.indexOf('.')
  const last = dot >= 0 ? name.slice(dot + 1) : name
  return last.trim().toLowerCase()
}

// nflverse CSV uses (game_type, week) where week increments through POST:
// 17-game era: REG 1-17, WC 18, DIV 19, CON 20, SB 21
// 18-week era: REG 1-18, WC 19, DIV 20, CON 21, SB 22
// Our DB uses (seas_type, week) where POST week resets to 1/2/3/4.
const GAME_TYPE_TO_SEAS_TYPE = {
  REG: 'REG',
  WC: 'POST',
  DIV: 'POST',
  CON: 'POST',
  CONF: 'POST',
  SB: 'POST'
}
const POST_GAME_TYPE_WEEK = { WC: 1, DIV: 2, CON: 3, CONF: 3, SB: 4 }

const build_jersey_to_pid_index = async ({ year, force_download }) => {
  const csv_path = await download_csv({ year, force_download })
  const rows = await readCSV(csv_path)
  if (rows instanceof Error) throw rows

  // Keep ACT/INA/RES rows across ALL game_types (REG/POST/PRE).
  const active_statuses = new Set([
    'ACT',
    'INA',
    'RES',
    'RSN',
    'RSR',
    'PUP',
    'SUS'
  ])
  const candidates = rows.filter(
    (r) => active_statuses.has(r.status) && r.gsis_id
  )

  // gsis_id -> pid via single batched query
  const gsis_ids = Array.from(new Set(candidates.map((r) => r.gsis_id)))
  const player_rows = await db('player')
    .select('pid', 'gsisid')
    .whereIn('gsisid', gsis_ids)
  const pid_by_gsis = new Map(player_rows.map((p) => [p.gsisid, p.pid]))

  // Keys are `${team}-${seas_type}-${week}-${jnum}` (and lastname variant) so
  // REG W1 and POST W1 (Wild Card) don't collide.
  const by_jersey = new Map()
  const by_lastname = new Map()

  for (const r of candidates) {
    const pid = pid_by_gsis.get(r.gsis_id)
    if (!pid) continue

    let team
    try {
      team = fixTeam(NFLVERSE_TEAM_ALIASES[r.team] || r.team)
    } catch {
      continue
    }

    const seas_type = GAME_TYPE_TO_SEAS_TYPE[r.game_type]
    if (!seas_type) continue
    const week =
      seas_type === 'POST' ? POST_GAME_TYPE_WEEK[r.game_type] : Number(r.week)

    const key_prefix = `${team}-${seas_type}-${week}`
    if (r.jersey_number) {
      by_jersey.set(`${key_prefix}-${Number(r.jersey_number)}`, pid)
    }
    const lname = (r.last_name || '').trim().toLowerCase()
    if (lname) {
      by_lastname.set(`${key_prefix}-${lname}`, pid)
    }
  }

  log(
    `year=${year} index: ${by_jersey.size} jersey keys, ${by_lastname.size} lastname keys, ${pid_by_gsis.size}/${gsis_ids.length} gsis->pid resolved`
  )
  return { by_jersey, by_lastname }
}

const resolve_player = ({ team, seas_type, week, jnum, name, index }) => {
  // Primary: exact seas_type / week match.
  const lname = last_name_of(name)
  const prefix = `${team}-${seas_type}-${week}`
  const j_hit = index.by_jersey.get(`${prefix}-${jnum}`)
  if (j_hit) return { pid: j_hit, via: 'jersey' }
  const l_hit = index.by_lastname.get(`${prefix}-${lname}`)
  if (l_hit) return { pid: l_hit, via: 'lastname' }

  // PRE games have no nflverse CSV coverage (CSV omits PRE entirely);
  // fall back to REG W1 since the active 53 is largely the same roster.
  if (seas_type === 'PRE') {
    const reg_prefix = `${team}-REG-1`
    const j_hit_pre = index.by_jersey.get(`${reg_prefix}-${jnum}`)
    if (j_hit_pre) return { pid: j_hit_pre, via: 'jersey_pre_fallback' }
    const l_hit_pre = index.by_lastname.get(`${reg_prefix}-${lname}`)
    if (l_hit_pre) return { pid: l_hit_pre, via: 'lastname_pre_fallback' }
  }

  return null
}

const process_game = async ({ game, index, dry_run }) => {
  const pdf_path = cache_path_for(game.esbid)
  if (!fs.existsSync(pdf_path)) {
    return { skipped: 'no_pdf', starters_written: 0 }
  }

  let parsed
  try {
    parsed = await parse_gamebook_lineups({ pdf_path })
  } catch (err) {
    log(`parse-fail esbid=${game.esbid}: ${err.message}`)
    return { skipped: 'parse_fail', starters_written: 0 }
  }

  // Map the PDF's left/right teams to the DB's (h, v). Normalize both sides
  // through fixTeam so pre-relocation codes (SD/OAK/STL) match modern PDF
  // labels (LAC/LV/LA). If neither matches, skip the game (e.g., Pro Bowl
  // AFC/NFC).
  let h_abbr
  let v_abbr
  try {
    h_abbr = fixTeam(game.h)
    v_abbr = fixTeam(game.v)
  } catch {
    return { skipped: 'team_mismatch', starters_written: 0 }
  }
  const game_teams = new Set([h_abbr, v_abbr])
  if (!game_teams.has(parsed.left.abbr) || !game_teams.has(parsed.right.abbr)) {
    log(
      `team-mismatch esbid=${game.esbid} pdf=[${parsed.left.abbr},${parsed.right.abbr}] db=[${game.h},${game.v}]`
    )
    return { skipped: 'team_mismatch', starters_written: 0 }
  }

  // Build starter rows per quadrant against the side's team abbreviation.
  const starter_rows = []
  let resolved = 0
  let attempted = 0
  for (const side of [parsed.left, parsed.right]) {
    for (const slot of [...side.offense, ...side.defense]) {
      attempted += 1
      const match = resolve_player({
        team: side.abbr,
        seas_type: game.seas_type,
        week: game.week,
        jnum: slot.jnum,
        name: slot.name,
        index
      })
      if (!match) continue
      resolved += 1
      starter_rows.push({
        pid: match.pid,
        esbid: game.esbid,
        year: game.year,
        started: true
      })
    }
  }

  const rate = attempted > 0 ? resolved / attempted : 0
  if (rate < RESOLUTION_FLOOR_PER_GAME) {
    log(
      `[resolution-floor-breach] esbid=${game.esbid} ${resolved}/${attempted} (${(rate * 100).toFixed(1)}%) -- skipping writes`
    )
    return { skipped: 'floor_breach', starters_written: 0, resolved, attempted }
  }

  // Dedupe by pid (a player resolving twice -- e.g., LT and RT slots both
  // pointing at the same swing tackle -- still produces one started=true row).
  const dedup_by_pid = new Map()
  for (const r of starter_rows) dedup_by_pid.set(r.pid, r)
  const final_rows = Array.from(dedup_by_pid.values())

  if (dry_run) {
    return { starters_written: final_rows.length, resolved, attempted }
  }

  // UPDATE only -- never INSERT. The gamebook importer adds `started` to
  // player_gamelogs rows created by the rosters importers (which populate
  // tm/opp/pos/active and satisfy player_gamelogs.opp NOT NULL). If no
  // matching row exists for (esbid, pid, year), the starter is silently
  // dropped -- count these to surface upstream rosters-importer gaps.
  let updated_count = 0
  for (const r of final_rows) {
    // Skip rows mistakenly tagged tm='INA' by upstream rosters importers --
    // 'INA' is a roster-status code (inactive), not a team. The (esbid, pid)
    // resolves to a row whose `tm` is wrong; setting started=true there would
    // produce nonsense team-level aggregates.
    const n = await db('player_gamelogs')
      .where({ esbid: r.esbid, pid: r.pid, year: r.year })
      .whereNot({ tm: 'INA' })
      .update({ started: r.started })
    updated_count += n
  }

  // Sweep remainder of the dressed roster to started=false. Same INA guard.
  await db('player_gamelogs')
    .where({ esbid: game.esbid })
    .whereNull('started')
    .whereNot({ tm: 'INA' })
    .andWhere((q) => q.where('active', true).orWhereNull('active'))
    .update({ started: false })

  return {
    starters_written: updated_count,
    starters_attempted_write: final_rows.length,
    resolved,
    attempted
  }
}

const import_for_year = async ({
  year,
  week,
  seas_type,
  force_download,
  dry_run
}) => {
  const query = db('nfl_games')
    .select('esbid', 'year', 'week', 'h', 'v', 'seas_type', 'shieldid')
    .where({ year })
    .whereNotNull('shieldid')
  if (week !== undefined) query.where({ week })
  if (seas_type) query.where({ seas_type })
  const games = await query
  log(
    `${year}${week !== undefined ? ` W${week}` : ''}: ${games.length} games to process`
  )

  const index = await build_jersey_to_pid_index({ year, force_download })

  const counts = {
    games_processed: 0,
    games_written: 0,
    games_no_pdf: 0,
    games_parse_fail: 0,
    games_team_mismatch: 0,
    games_floor_breach: 0,
    starter_rows_written: 0,
    starters_no_gamelog_row: 0
  }

  for (const game of games) {
    counts.games_processed += 1
    const result = await process_game({ game, index, dry_run })
    if (result.skipped === 'no_pdf') counts.games_no_pdf += 1
    else if (result.skipped === 'parse_fail') counts.games_parse_fail += 1
    else if (result.skipped === 'team_mismatch') counts.games_team_mismatch += 1
    else if (result.skipped === 'floor_breach') counts.games_floor_breach += 1
    else {
      counts.games_written += 1
      counts.starter_rows_written += result.starters_written || 0
      counts.starters_no_gamelog_row +=
        (result.starters_attempted_write || 0) - (result.starters_written || 0)
    }
  }

  log(`${year}: ${JSON.stringify(counts)}`)
  return counts
}

const import_nfl_gamebook_starters = async ({
  year,
  start_year,
  end_year,
  week,
  seas_type,
  force_download = false,
  dry_run = false
}) => {
  const years = []
  if (start_year && end_year) {
    if (start_year > end_year) {
      throw new Error(`start_year ${start_year} > end_year ${end_year}`)
    }
    for (let y = start_year; y <= end_year; y++) years.push(y)
  } else {
    years.push(year || current_season.year)
  }

  const totals = {
    games_processed: 0,
    games_written: 0,
    games_no_pdf: 0,
    games_parse_fail: 0,
    games_team_mismatch: 0,
    games_floor_breach: 0,
    starter_rows_written: 0,
    starters_no_gamelog_row: 0
  }
  for (const y of years) {
    const c = await import_for_year({
      year: y,
      week,
      seas_type,
      force_download,
      dry_run
    })
    for (const k of Object.keys(totals)) totals[k] += c[k]
  }

  log(`totals across ${years.length} year(s): ${JSON.stringify(totals)}`)

  // Output oracle: at least one game processed, average starters/game >= 40.
  const avg =
    totals.games_written > 0
      ? totals.starter_rows_written / totals.games_written
      : 0
  const shortfall =
    totals.games_processed === 0
      ? `import-nfl-gamebook-starters: 0 games processed`
      : totals.games_written > 0 && avg < 40
        ? `import-nfl-gamebook-starters: avg ${avg.toFixed(1)} starters/game below 40 (rows=${totals.starter_rows_written} games=${totals.games_written})`
        : null
  return { shortfall, totals }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await import_nfl_gamebook_starters({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      week: argv.week,
      seas_type: argv.seas_type,
      force_download: argv.force_download,
      dry_run: argv.dry_run
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.IMPORT_NFL_GAMEBOOK_STARTERS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nfl_gamebook_starters
