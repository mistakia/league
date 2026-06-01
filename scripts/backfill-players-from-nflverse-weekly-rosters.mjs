/**
 * Backfill Players from nflverse weekly_rosters CSVs
 *
 * Reads roster_weekly_{year}.csv for each year in range and creates a
 * player row for every gsis_id present in the CSV but missing from the
 * `player` table. Required because historical NFL player coverage in our
 * DB is sparse (17-20% gap for 2002-2010 NFL players), which blocks
 * scripts/import-nfl-gamebook-starters.mjs from resolving early-era
 * starters via gsis_id.
 *
 * For each missing gsis_id, picks the CSV row with the most-complete
 * required fields and calls createPlayer().
 *
 * Usage:
 *   node scripts/backfill-players-from-nflverse-weekly-rosters.mjs --year 2003
 *   node scripts/backfill-players-from-nflverse-weekly-rosters.mjs --start_year 2002 --end_year 2013
 *   node scripts/backfill-players-from-nflverse-weekly-rosters.mjs --year 2003 --dry_run
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
import {
  is_main,
  report_job,
  fetch_with_retry,
  createPlayer,
  updatePlayer,
  readCSV
} from '#libs-server'
import generate_player_id from '#libs-server/generate-player-id.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('backfill-players-from-nflverse-weekly-rosters')
debug.enable('backfill-players-from-nflverse-weekly-rosters,create-player')

const stream_pipeline = promisify(pipeline)

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', { type: 'number' })
    .option('start_year', { type: 'number' })
    .option('end_year', { type: 'number' })
    .option('force_download', { type: 'boolean', default: false })
    .option('dry_run', { type: 'boolean', default: false }).argv

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

// Score a CSV row by how many createPlayer-required fields are populated.
// Used to pick the "best" row for a player who appears across many weeks.
const REQUIRED_FOR_SCORE = [
  'first_name',
  'last_name',
  'birth_date',
  'entry_year',
  'position',
  'height',
  'weight'
]
const score_row = (r) => REQUIRED_FOR_SCORE.filter((f) => r[f]).length

// Pre-normalize historical nflverse team codes that fixTeam doesn't know.
const NFLVERSE_TEAM_ALIASES = {
  SL: 'STL',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  ARZ: 'ARI'
}

// Map a CSV row to the createPlayer playerData shape.
const csv_row_to_player_data = (r) => ({
  fname: r.first_name,
  lname: r.last_name,
  dob: r.birth_date,
  nfl_draft_year: Number(r.entry_year) || Number(r.rookie_year) || null,
  pos: r.position,
  pos1: r.depth_chart_position || r.position,
  posd: r.depth_chart_position || r.position,
  height: r.height ? Number(r.height) : null,
  weight: r.weight ? Number(r.weight) : null,
  col: r.college || null,
  current_nfl_team: r.team
    ? NFLVERSE_TEAM_ALIASES[r.team] || r.team
    : null,
  gsisid: r.gsis_id,
  esbid: r.esb_id || null,
  gsis_it_id: r.gsis_it_id || null,
  espn_id: r.espn_id || null,
  sportradar_id: r.sportradar_id || null,
  yahoo_id: r.yahoo_id || null,
  rotowire_id: r.rotowire_id || null,
  pff_id: r.pff_id || null,
  pfr_id: r.pfr_id || null,
  fantasy_data_id: r.fantasy_data_id || null,
  sleeper_id: r.sleeper_id || null,
  draft_team: r.draft_club
    ? NFLVERSE_TEAM_ALIASES[r.draft_club] || r.draft_club
    : null,
  roster_status: 'CUT' // safest default; daily importers (Sleeper / NFL) will refresh
})

const backfill_year = async ({ year, force_download, dry_run }) => {
  const csv_path = await download_csv({ year, force_download })
  const rows = await readCSV(csv_path)
  if (rows instanceof Error) throw rows

  // All rows with a gsis_id are candidates; we don't filter by status here
  // because even DEV/CUT players can be starters in another week's CSV
  // (status changes mid-season).
  const candidates = rows.filter((r) => r.gsis_id)

  const csv_gsis = new Set(candidates.map((r) => r.gsis_id))
  const have = await db('player')
    .select('gsisid')
    .whereIn('gsisid', Array.from(csv_gsis))
  const have_set = new Set(have.map((r) => r.gsisid))
  const missing_gsis = Array.from(csv_gsis).filter((g) => !have_set.has(g))

  log(
    `${year}: ${csv_gsis.size} unique gsis_ids in CSV, ${missing_gsis.length} missing from player table`
  )
  if (!missing_gsis.length) return { missing: 0, created: 0, failed: 0 }

  // Group rows by gsis_id and pick the best-scoring row per missing player.
  const by_gsis = new Map()
  for (const r of candidates) {
    if (have_set.has(r.gsis_id)) continue
    const existing = by_gsis.get(r.gsis_id)
    if (!existing || score_row(r) > score_row(existing)) {
      by_gsis.set(r.gsis_id, r)
    }
  }

  let created = 0
  let updated = 0
  let failed = 0
  const failure_samples = []
  for (const [gsis_id, r] of by_gsis.entries()) {
    const player_data = csv_row_to_player_data(r)
    if (dry_run) {
      created += 1
      continue
    }
    // generate_player_id collides with existing (name, draft_year, dob) tuples;
    // when so, the right action is to set gsisid + other null IDs on the
    // existing row rather than insert a duplicate. Only fall through to
    // createPlayer when no existing record matches.
    let candidate_pid
    try {
      candidate_pid = generate_player_id(player_data)
    } catch (err) {
      failed += 1
      if (failure_samples.length < 5) {
        failure_samples.push({
          gsis_id,
          name: r.full_name,
          reason: `generate_player_id failed: ${err.message}`
        })
      }
      continue
    }
    const existing = await db('player').where({ pid: candidate_pid }).first()
    if (existing) {
      const update = {}
      for (const k of [
        'gsisid',
        'esbid',
        'gsis_it_id',
        'espn_id',
        'sportradar_id',
        'yahoo_id',
        'rotowire_id',
        'pff_id',
        'pfr_id',
        'fantasy_data_id',
        'sleeper_id'
      ]) {
        if (player_data[k] && !existing[k]) update[k] = player_data[k]
      }
      if (!Object.keys(update).length) {
        failed += 1
        if (failure_samples.length < 5) {
          failure_samples.push({
            gsis_id,
            name: r.full_name,
            reason: 'existing pid has all IDs populated already'
          })
        }
        continue
      }
      const changes = await updatePlayer({
        player_row: existing,
        update,
        allow_protected_props: false
      })
      if (changes) updated += 1
      else failed += 1
      continue
    }
    const result = await createPlayer(player_data)
    if (result) {
      created += 1
    } else {
      failed += 1
      if (failure_samples.length < 5) {
        failure_samples.push({
          gsis_id,
          name: r.full_name,
          missing_fields: REQUIRED_FOR_SCORE.filter((f) => !r[f])
        })
      }
    }
  }

  log(
    `${year}: created ${created}, updated ${updated}, failed ${failed} (of ${missing_gsis.length} missing)`
  )
  if (failure_samples.length) {
    log('failure samples:')
    for (const s of failure_samples) log(s)
  }
  return { missing: missing_gsis.length, created, updated, failed }
}

const backfill_players = async ({
  year,
  start_year,
  end_year,
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
    years.push(year)
  }

  const totals = { missing: 0, created: 0, updated: 0, failed: 0 }
  for (const y of years) {
    const c = await backfill_year({ year: y, force_download, dry_run })
    for (const k of Object.keys(totals)) totals[k] += c[k]
  }

  log(`totals across ${years.length} year(s): ${JSON.stringify(totals)}`)
  return { totals }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await backfill_players({
      year: argv.year,
      start_year: argv.start_year,
      end_year: argv.end_year,
      force_download: argv.force_download,
      dry_run: argv.dry_run
    })
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_NFLVERSE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_players
