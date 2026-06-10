/**
 * Import NFL Player Roster Status from NFLverse Data
 *
 * Downloads nflverse players.parquet and refreshes player.roster_status.
 *
 * Scope: writes ONLY roster_status. current_nfl_team is owned by
 * import-players-sleeper.mjs and import-players-nfl.mjs, both of which
 * correctly clear it to 'INA' on release; the offseason gap that nflverse
 * closes is the roster_status flip to UNSIGNED_FREE_AGENT / CUT / RET.
 *
 * Stale-retiree guard: nflverse `status` is stuck for long-retired players
 * (Tom Brady carries status=ACT, latest_team=TB years after retirement).
 * Rows where last_season < current_season.year - 1 are skipped so a known-
 * retired player isn't regressed back to ACTIVE.
 *
 * Cron: 03:05 daily, before Sleeper (03:30) and NFL.com (03:30) so the
 * later runs claim last-write naturally on any disagreement. Staggered five
 * minutes after import-player-contracts-nflverse.mjs (03:00) to avoid
 * simultaneous parquet downloads from the same nflverse releases endpoint.
 *
 * Data Source: https://github.com/nflverse/nflverse-data/releases/tag/players
 *
 * Usage:
 *   node import-players-nflverse.mjs [--force_download] [--dry-run]
 */

import debug from 'debug'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { asyncBufferFromFile, parquetRead } from 'hyparquet'

import db from '#db'
import { format_nfl_status } from '#libs-shared'
import { current_season, is_offseason } from '#constants'
import {
  is_main,
  report_job,
  fetch_with_retry,
  batch_insert
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'

import validate_response_shape from './import-players-nflverse.validate.mjs'

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('force_download', { type: 'boolean', default: false })
    .option('dry-run', { type: 'boolean', default: false }).argv

const log = debug('import-players-nflverse')
debug.enable('import-players-nflverse,get-player,fetch')

const NFLVERSE_PLAYERS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet'
const BATCH_SIZE = 100

const PLAYER_CACHE_OPTIONS = {
  all_players: true,
  include_otc_id_index: true,
  include_name_draft_index: true
}

const find_player_from_nflverse_row = ({ row }) => {
  const opts = { ignore_free_agent: false, ignore_retired: false }

  if (row.otc_id) {
    const player = find_player({ otc_id: row.otc_id, ...opts })
    if (player) return player
  }

  if (row.gsis_id) {
    const player = find_player({ gsisid: row.gsis_id, ...opts })
    if (player) return player
  }

  if (row.display_name && row.draft_year) {
    const player = find_player({
      name: row.display_name,
      nfl_draft_year: row.draft_year,
      ...opts
    })
    if (player) return player
  }

  return null
}

const download_players_file = async ({ force_download = false }) => {
  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `nflverse_players_${current_date}.parquet`
  const file_path = `${os.tmpdir()}/${file_name}`

  if (force_download || !fs.existsSync(file_path)) {
    log('downloading players.parquet from nflverse')
    const stream_pipeline = promisify(pipeline)
    const response = await fetch_with_retry({ url: NFLVERSE_PLAYERS_URL })
    if (!response.ok) {
      throw new Error(`download failed: ${response.statusText}`)
    }
    await stream_pipeline(response.body, fs.createWriteStream(file_path))
    log(`downloaded to ${file_path}`)
  } else {
    log(`using cached file: ${file_path}`)
  }

  return file_path
}

const read_parquet_rows = (parquet_file) =>
  new Promise((resolve, reject) => {
    parquetRead({
      file: parquet_file,
      rowFormat: 'object',
      onComplete: (data) => resolve(data)
    }).catch(reject)
  })

const process_players_data = ({ data, dry_run, dryrun_path }) => {
  const stats = {
    processed: 0,
    matched: 0,
    skipped_missing_player: 0,
    skipped_stale_last_season: 0,
    skipped_unmapped: 0,
    written: 0
  }
  const unmapped_codes_seen = new Set()
  const updates = []
  const dryrun_stream = dry_run
    ? fs.createWriteStream(dryrun_path, { flags: 'w' })
    : null

  const stale_floor = current_season.year - 1

  for (const row of data) {
    stats.processed += 1

    const player = find_player_from_nflverse_row({ row })
    if (!player) {
      stats.skipped_missing_player += 1
      continue
    }
    stats.matched += 1

    if (row.last_season < stale_floor) {
      stats.skipped_stale_last_season += 1
      continue
    }

    let roster_status
    try {
      roster_status = format_nfl_status(row.status)
    } catch (err) {
      stats.skipped_unmapped += 1
      if (!unmapped_codes_seen.has(row.status)) {
        unmapped_codes_seen.add(row.status)
        log(`unmapped nflverse status: ${row.status}`)
      }
      continue
    }
    if (!roster_status) {
      stats.skipped_unmapped += 1
      continue
    }

    updates.push({ pid: player.pid, roster_status })
    stats.written += 1

    if (dryrun_stream) {
      dryrun_stream.write(
        JSON.stringify({
          pid: player.pid,
          display_name: row.display_name,
          nflverse_status: row.status,
          last_season: row.last_season,
          mapped_roster_status: roster_status
        }) + '\n'
      )
    }
  }

  if (dryrun_stream) dryrun_stream.end()

  return { stats, updates }
}

const save_player_updates = async (updates) => {
  if (!updates.length) return
  log(`saving ${updates.length} roster_status updates`)
  await batch_insert({
    items: updates,
    batch_size: BATCH_SIZE,
    save: (batch) =>
      Promise.all(
        batch.map((u) =>
          db('player')
            .where('pid', u.pid)
            .update({ roster_status: u.roster_status })
        )
      )
  })
}

const import_players_nflverse = async ({
  force_download = false,
  dry_run = false
} = {}) => {
  const file_path = await download_players_file({ force_download })
  const parquet_file = await asyncBufferFromFile(file_path)
  const data = await read_parquet_rows(parquet_file)

  const preflight = validate_response_shape({ rows: data, is_offseason })
  log(
    `preflight ok: ${preflight.rows} rows; status_counts=${JSON.stringify(preflight.status_counts)}`
  )

  log('initializing player cache')
  await preload_active_players(PLAYER_CACHE_OPTIONS)

  const dryrun_path = dry_run
    ? path.join(
        process.cwd(),
        'tmp',
        `import-players-nflverse-dryrun-${new Date().toISOString().split('T')[0]}.jsonl`
      )
    : null
  if (dry_run) fs.mkdirSync(path.dirname(dryrun_path), { recursive: true })

  const { stats, updates } = process_players_data({
    data,
    dry_run,
    dryrun_path
  })

  log(
    `processed=${stats.processed} matched=${stats.matched} ` +
      `skipped_missing_player=${stats.skipped_missing_player} ` +
      `skipped_stale_last_season=${stats.skipped_stale_last_season} ` +
      `skipped_unmapped=${stats.skipped_unmapped} ` +
      `written=${stats.written}`
  )

  if (dry_run) {
    log(`dry-run: per-row decisions written to ${dryrun_path}; no DB writes`)
    return
  }

  await save_player_updates(updates)
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_players_nflverse({
      force_download: argv.force_download,
      dry_run: argv['dry-run']
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_NFLVERSE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_players_nflverse
