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
  batch_insert,
  ensure_player_alias
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'

import validate_response_shape from './import-players-nflverse.validate.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('force_download', { type: 'boolean', default: false })
    .option('dry-run', { type: 'boolean', default: false }).argv

const log = debug('import-players-nflverse')
enable_debug_namespaces('import-players-nflverse,get-player,fetch')

const NFLVERSE_PLAYERS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet'
const BATCH_SIZE = 100

const PLAYER_CACHE_OPTIONS = {
  all_players: true,
  include_otc_id_index: true,
  include_name_draft_index: true
}

/*
  BOTH spellings of a divergent first name, seeded as aliases so the
  nickname/legal-name duplicate class stops re-forming at mint time.

  This feed carries a player's legal first name (`first_name`) and his football
  name (`football_name`) on the SAME row -- 1,450 players differ -- and it runs
  daily at 3:05, twenty-five minutes before import-players-sleeper mints at
  3:30. Sleeper's payload carries one spelling only, so when its spelling is not
  the one our row holds, its resolver answers `new` and a SECOND row for the
  same person is minted: 77 such pairs had to be merged by hand on 2026-08-17,
  and the 2026 rookies (Lebbeus/L.T. Overton, Khalil/Red Murdock,
  Patrick/Pat Coogan, James/Jimmy Rolder) are the live shape.

  Seeding is the prevention the merge round could not be. An alias is an
  exact-match alternate recorded against a pid this importer already resolved by
  otc or gsis id, so it never loosens matching and carries no reused-name hijack
  risk (see ensure-player-alias.mjs). Both directions are recorded because
  either spelling can be minted first.

  It deliberately does NOT attach on the (last_name, college, draft_year) anchor
  the standing nickname-legal-name check uses. That anchor also joins genuine
  two-person pairs -- Colton and Dylan Taylor, three brother pairs -- and
  merging two people on the write side is unrecoverable, which is exactly why
  that check was left a detector rather than a mint-time guard.
*/
export const divergent_name_variants = ({
  first_name,
  last_name,
  football_name
}) => {
  if (!first_name || !last_name || !football_name) return []
  if (football_name.toLowerCase() === first_name.toLowerCase()) return []
  return [`${first_name} ${last_name}`, `${football_name} ${last_name}`]
}

const find_player_from_nflverse_row = ({ row }) => {
  const opts = { ignore_free_agent: false, ignore_retired: false }

  if (row.otc_id) {
    const player = find_player({ otc_player_id: row.otc_id, ...opts })
    if (player) return player
  }

  if (row.gsis_id) {
    const player = find_player({ gsis_player_id: row.gsis_id, ...opts })
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

export const download_players_file = async ({ force_download = false }) => {
  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `nflverse_players_${current_date}.parquet`
  const file_path = `${os.tmpdir()}/${file_name}`

  if (force_download || !fs.existsSync(file_path)) {
    log('downloading players.parquet from nflverse')
    const stream_pipeline = promisify(pipeline)
    // use_proxy: false -- public GitHub release asset, not a vendor scrape target.
    const response = await fetch_with_retry({
      url: NFLVERSE_PLAYERS_URL,
      use_proxy: false
    })
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

export const read_parquet_rows = (parquet_file) =>
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
  const alias_candidates = []
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

    // Collected BEFORE the status mapping below, which drops a row whose
    // nflverse status has no mapping here. A name is not a status, and a rookie
    // carrying an unmapped one is exactly the row the duplicate class forms on.
    const name_variants = divergent_name_variants(row)
    if (name_variants.length) {
      alias_candidates.push({
        pid: player.pid,
        formatted_name: player.formatted_name || null,
        variants: name_variants
      })
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

  return { stats, updates, alias_candidates }
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

/*
  Idempotent and self-skipping: ensure_player_alias records nothing for a variant
  equal to the player's canonical name or already present, so a rerun seeds zero
  and the count reads as the new spellings this feed taught us.
*/
const seed_name_aliases = async (alias_candidates) => {
  let seeded = 0
  for (const { pid, formatted_name, variants } of alias_candidates) {
    for (const variant of variants) {
      seeded += await ensure_player_alias({
        pid,
        name: variant,
        formatted_name,
        source: 'nflverse-players'
      })
    }
  }
  return seeded
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

  const { stats, updates, alias_candidates } = process_players_data({
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
    log(
      `dry-run: would seed name variants for ${alias_candidates.length} players`
    )
    return
  }

  await save_player_updates(updates)

  const aliases_seeded = await seed_name_aliases(alias_candidates)
  log(
    `seeded ${aliases_seeded} new name aliases across ${alias_candidates.length} players whose football_name differs from first_name`
  )

  return { aliases_seeded }
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
