/**
 * Import NFLverse Weekly Rosters
 *
 * Replaces the active=false signal that was lost when commit 84c52f63
 * deleted scripts/import-player-gamelogs.mjs and libs-server/nfl.mjs::get_plays_v3
 * (the NFL.com FDL gameDetail GraphQL inactive lists). NFL Pro's teams/rosterWeek
 * endpoint -- which private/scripts/import-gameday-rosters.mjs hits -- returns
 * only the 48-man dressed roster, no inactives.
 *
 * nflverse weekly_rosters covers 2002+ with a stable status enum:
 *   ACT -> active=true   (dressed for the game)
 *   INA -> active=false  (game-day inactive)
 *   RES -> active=false  (reserve list: IR / PUP / NFI / SUSP)
 *   DEV -> active=false  (practice squad -- not on the active 53 for this week)
 *   CUT, RET, EXE, TRC, TRD -> skipped (not on the team for this week's game)
 *
 * Source: https://github.com/nflverse/nflverse-data/releases/tag/weekly_rosters
 *
 * Usage:
 *   node scripts/import-nflverse-weekly-rosters.mjs --year 2024
 *   node scripts/import-nflverse-weekly-rosters.mjs --start_year 2009 --end_year 2025
 *   node scripts/import-nflverse-weekly-rosters.mjs --year 2024 --dry_run
 */

import debug from 'debug'
import fs from 'fs'
import os from 'os'
import path from 'path'
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
  batch_insert,
  throw_if_shortfall,
  readCSV
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import { validate_response_shape } from './import-nflverse-weekly-rosters.validate.mjs'

const log = debug('import-nflverse-weekly-rosters')
debug.enable('import-nflverse-weekly-rosters')

const SOURCE_SENTINEL = 'nflverse-weekly-rosters'
const BATCH_SIZE = 500
// active=true:  ACT (dressed gameday)
// active=false: INA (2020+ gameday inactive), RES (IR/PUP/NFI), RSN (reserve non-football),
//               RSR (reserve, retired -- rare), PUP (pre-2020 PUP token), SUS (suspended)
// skip:         everything else -- player was not on the team's active 53-man for this week
//               (DEV practice squad, CUT, RET, TRC trade-claim, TRD traded, TRT tryout,
//               NWT not-with-team, EXE exempt, UFA/RFA/UDF free-agent flags, '' missing, E01)
const STATUS_ACTIVE = new Set(['ACT'])
const STATUS_INACTIVE = new Set(['INA', 'RES', 'RSN', 'RSR', 'PUP', 'SUS'])

// nflverse uses legacy team codes in historical files; fixTeam doesn't know
// these so pre-normalise to modern abbreviations it does recognise.
const NFLVERSE_TEAM_ALIASES = {
  SL: 'STL', // St. Louis Rams (pre-2016)
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  ARZ: 'ARI'
}

const stream_pipeline = promisify(pipeline)

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('dry_run', { type: 'boolean', default: false })
    .option('force_download', { type: 'boolean', default: false }).argv

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
    log(`downloaded to ${file_path}`)
  } else {
    log(`using cached file: ${file_path}`)
  }
  return file_path
}

const parse_csv = async (file_path) => {
  const result = await readCSV(file_path)
  if (result instanceof Error) throw result
  return result
}

const build_player_index = async ({ gsis_ids }) => {
  if (!gsis_ids.size) return { by_gsis_id: new Map(), by_name_year: new Map() }
  const rows = await db('player')
    .select(
      'pid',
      'gsis_player_id',
      'first_name',
      'last_name',
      'nfl_draft_year'
    )
    .whereIn('gsis_player_id', Array.from(gsis_ids))
  const by_gsis_id = new Map(rows.map((r) => [r.gsis_player_id, r]))
  // Name-fallback index is built lazily below from a wider query, only if needed.
  return { by_gsis_id, by_name_year: new Map() }
}

const build_name_year_index = async () => {
  const rows = await db('player').select(
    'pid',
    'first_name',
    'last_name',
    'nfl_draft_year'
  )
  const idx = new Map()
  for (const r of rows) {
    if (!r.first_name || !r.last_name) continue
    const key = `${r.first_name.toLowerCase()}|${r.last_name.toLowerCase()}|${r.nfl_draft_year || ''}`
    // Last write wins; collisions are rare (homonyms with same draft year).
    idx.set(key, r)
  }
  return idx
}

const build_game_index = async ({ year }) => {
  const rows = await db('nfl_games')
    .select('esbid', 'week', 'h', 'v')
    .where({ season_year: year, season_type: 'REG' })
  const idx = new Map()
  for (const g of rows) {
    const h = fixTeam(g.h)
    const v = fixTeam(g.v)
    idx.set(`${g.week}|${h}`, { esbid: g.esbid, tm: h, opp: v })
    idx.set(`${g.week}|${v}`, { esbid: g.esbid, tm: v, opp: h })
  }
  return idx
}

const resolve_pid = ({ row, player_by_gsis_id, name_year_idx }) => {
  if (row.gsis_id) {
    const p = player_by_gsis_id.get(row.gsis_id)
    if (p) return { pid: p.pid, via: 'gsis_id' }
  }
  if (row.first_name && row.last_name) {
    const key = `${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}|${row.entry_year || ''}`
    const p = name_year_idx.get(key)
    if (p) return { pid: p.pid, via: 'name_year' }
  }
  return null
}

const import_for_year = async ({ year, dry_run, force_download }) => {
  log(`processing year ${year}`)
  const file_path = await download_csv({ year, force_download })
  const rows = await parse_csv(file_path)
  log(`parsed ${rows.length} rows from ${path.basename(file_path)}`)

  const validation = validate_response_shape({ rows })
  log(
    `preflight ok: ${validation.rows} rows; status counts=${JSON.stringify(
      validation.status_counts
    )}`
  )

  // Filter to REG-season rows the index cares about.
  const reg_rows = rows.filter((r) => r.game_type === 'REG')
  log(`${reg_rows.length} REG rows after game_type filter`)

  // Only keep statuses that mean the player was on the team's active 53-man
  // for this week's game. Everything else (practice squad, cuts, trades,
  // tryouts, free-agent flags) is skipped.
  const candidate_rows = reg_rows.filter(
    (r) => STATUS_ACTIVE.has(r.status) || STATUS_INACTIVE.has(r.status)
  )
  log(
    `${candidate_rows.length} candidate rows after dropping ${reg_rows.length - candidate_rows.length} non-roster statuses`
  )

  // Build resolution indexes.
  const gsis_ids = new Set(candidate_rows.map((r) => r.gsis_id).filter(Boolean))
  const { by_gsis_id: player_by_gsis_id } = await build_player_index({
    gsis_ids
  })
  const name_year_idx = await build_name_year_index()
  const game_idx = await build_game_index({ year })

  // Build inserts.
  const inserts = []
  const counts = {
    resolved_gsis: 0,
    resolved_name: 0,
    unresolved_pid: 0,
    unresolved_game: 0
  }
  const unresolved_pid_samples = []

  for (const row of candidate_rows) {
    const pid_match = resolve_pid({ row, player_by_gsis_id, name_year_idx })
    if (!pid_match) {
      counts.unresolved_pid += 1
      if (unresolved_pid_samples.length < 10) {
        unresolved_pid_samples.push({
          full_name: row.full_name,
          team: row.team,
          gsis_id: row.gsis_id,
          entry_year: row.entry_year
        })
      }
      continue
    }
    if (pid_match.via === 'gsis_id') counts.resolved_gsis += 1
    else counts.resolved_name += 1

    let team
    try {
      const normalised = NFLVERSE_TEAM_ALIASES[row.team] || row.team
      team = fixTeam(normalised)
    } catch (err) {
      counts.unresolved_game += 1
      continue
    }
    const game = game_idx.get(`${row.week}|${team}`)
    if (!game) {
      counts.unresolved_game += 1
      continue
    }

    inserts.push({
      pid: pid_match.pid,
      esbid: game.esbid,
      season_year: year,
      nfl_team: game.tm,
      opponent_nfl_team: game.opp,
      pos: row.position || 'UNK',
      active: STATUS_ACTIVE.has(row.status),
      source: SOURCE_SENTINEL
    })
  }

  // Dedupe (esbid, pid, year): a player can have multiple status entries
  // within a single week (e.g. promoted mid-week from DEV to ACT). Collapse
  // to one row per key. Precedence: ACT > inactive (any ACT means the
  // player dressed that game).
  const dedup = new Map()
  for (const ins of inserts) {
    const key = `${ins.esbid}|${ins.pid}|${ins.season_year}`
    const existing = dedup.get(key)
    if (!existing || (ins.active && !existing.active)) {
      dedup.set(key, ins)
    }
  }
  const before_dedup = inserts.length
  inserts.length = 0
  inserts.push(...dedup.values())
  if (before_dedup !== inserts.length) {
    log(
      `deduped ${before_dedup - inserts.length} (esbid,pid,year) duplicates -> ${inserts.length} rows`
    )
  }

  const total_attempted = candidate_rows.length
  const resolved = counts.resolved_gsis + counts.resolved_name
  const resolution_rate = resolved / total_attempted
  log(
    `resolution: ${resolved}/${total_attempted} (${(resolution_rate * 100).toFixed(1)}%) ` +
      `[gsis=${counts.resolved_gsis} name=${counts.resolved_name} unresolved=${counts.unresolved_pid} no_game=${counts.unresolved_game}]`
  )
  if (counts.unresolved_pid && unresolved_pid_samples.length) {
    log(`unresolved-pid samples (showing up to 10):`)
    for (const s of unresolved_pid_samples) log(s)
  }

  // Abort threshold mirrors B3 (70%) so a future schema break or massive ID
  // drift surfaces as a hard failure rather than silent partial backfill.
  if (resolution_rate < 0.7) {
    return {
      shortfall: `nflverse weekly_rosters ${year}: resolution rate ${(resolution_rate * 100).toFixed(1)}% below 70% floor (resolved ${resolved}/${total_attempted})`,
      inserts_written: 0
    }
  }

  // Diff preflight: classify each proposed insert against the existing
  // table state so we can audit the blast radius BEFORE committing.
  // Load all existing rows for this year (cheap: a partition scan) and
  // build an in-memory index keyed on (esbid, pid).
  const existing_rows = inserts.length
    ? await db('player_gamelogs')
        .select('esbid', 'pid', 'active')
        .where({ season_year: year })
    : []
  const existing_by_key = new Map(
    existing_rows.map((r) => [`${r.esbid}|${r.pid}`, r])
  )
  const diff = {
    new_insert: 0,
    no_change: 0,
    active_null_to_true: 0,
    active_null_to_false: 0,
    flip_true_to_false: 0,
    flip_false_to_true: 0
  }
  for (const ins of inserts) {
    const existing = existing_by_key.get(`${ins.esbid}|${ins.pid}`)
    if (!existing) {
      diff.new_insert += 1
      continue
    }
    if (existing.active === null && ins.active === true)
      diff.active_null_to_true += 1
    else if (existing.active === null && ins.active === false)
      diff.active_null_to_false += 1
    else if (existing.active === true && ins.active === false)
      diff.flip_true_to_false += 1
    else if (existing.active === false && ins.active === true)
      diff.flip_false_to_true += 1
    else diff.no_change += 1
  }
  log(`diff preflight for ${year}: ${JSON.stringify(diff)}`)

  // Sanity floor on true->false flips: if we're flipping more than 10% of
  // touched-existing rows from active=true to active=false, something is
  // wrong (data corruption or wrong-year mismatch). Abort before writing.
  const touched_existing =
    diff.no_change +
    diff.flip_true_to_false +
    diff.flip_false_to_true +
    diff.active_null_to_true +
    diff.active_null_to_false
  const true_to_false_pct =
    touched_existing > 0 ? diff.flip_true_to_false / touched_existing : 0
  if (true_to_false_pct > 0.1) {
    return {
      shortfall: `${year}: ${(true_to_false_pct * 100).toFixed(1)}% of touched rows flip active true->false (${diff.flip_true_to_false}/${touched_existing}) -- exceeds 10% sanity floor`,
      inserts_written: 0
    }
  }

  if (dry_run) {
    log(`dry_run: would write ${inserts.length} rows for ${year}`)
    return { shortfall: null, inserts_written: 0 }
  }

  // Delete-then-insert by (year, source) so reruns are idempotent and any
  // historical drift in resolution gets cleaned up.
  const deleted = await db('player_gamelogs')
    .where({ season_year: year, source: SOURCE_SENTINEL })
    .del()
  log(`deleted ${deleted} prior ${SOURCE_SENTINEL} rows for ${year}`)

  await batch_insert({
    items: inserts,
    batch_size: BATCH_SIZE,
    save: async (batch) => {
      // Narrow merge to `active` only. Existing rows from other importers
      // (gameday-rosters, stat builders) keep their source/pos/nfl_team/
      // opponent_nfl_team -- we
      // only assert authority over the boolean this importer exists to
      // populate. New INSERTs still tag source='nflverse-weekly-rosters'
      // for revert by sentinel.
      await db('player_gamelogs')
        .insert(batch)
        .onConflict(['esbid', 'pid', 'season_year'])
        .merge(['active'])
    }
  })
  log(`wrote ${inserts.length} rows for ${year} with source=${SOURCE_SENTINEL}`)

  return { shortfall: null, inserts_written: inserts.length }
}

const import_nflverse_weekly_rosters = async ({
  year,
  start_year,
  end_year,
  dry_run = false,
  force_download = false
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

  let total_written = 0
  const shortfalls = []
  for (const y of years) {
    const { shortfall, inserts_written } = await import_for_year({
      year: y,
      dry_run,
      force_download
    })
    total_written += inserts_written
    if (shortfall) shortfalls.push(shortfall)
  }

  log(`total rows written across ${years.length} year(s): ${total_written}`)
  return { shortfall: shortfalls.length ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await import_nflverse_weekly_rosters({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      dry_run: argv.dry_run,
      force_download: argv.force_download
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.IMPORT_NFLVERSE_WEEKLY_ROSTERS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nflverse_weekly_rosters
