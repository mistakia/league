import debug from 'debug'
import fs from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import os from 'os'

import db from '#db'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-espn-receiving-tracking-metrics')
debug.enable('import-espn-receiving-tracking-metrics')

const import_espn_receiving_tracking_metrics = async ({
  year = null,
  force_download = false,
  dry = false,
  file_path = null,
  collector = null
} = {}) => {
  const result = {
    players_updated: 0,
    players_not_matched: 0
  }
  const url = 'https://nfl-player-metrics.s3.amazonaws.com/rtm/rtm_data.json'
  const filename = 'rtm_data.json'
  const path = file_path || `${os.tmpdir()}/${filename}`

  let json_data
  if (force_download || !fs.existsSync(path)) {
    log(`downloading ${url}`)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`)
    json_data = await response.json()
    fs.writeFileSync(path, JSON.stringify(json_data))
  } else {
    log(`file exists: ${path}`)
    json_data = JSON.parse(fs.readFileSync(path, 'utf8'))
  }

  let single_season_data = json_data.filter(
    (item) => item.min_season === item.max_season
  )

  if (year) {
    const year_num = Number(year)
    const before_count = single_season_data.length
    single_season_data = single_season_data.filter(
      (item) => Number(item.min_season) === year_num
    )
    log(
      `Filtered to year ${year}: ${single_season_data.length} records (from ${before_count} total)`
    )
  }

  log(`single_season_data length: ${single_season_data.length}`)

  const players = await db('player').select(
    'pid',
    'gsis_player_id',
    'primary_position'
  )
  const player_seasonlogs_inserts = []
  const observed_at = new Date()

  for (const item of single_season_data) {
    const player = players.find((p) => p.gsis_player_id === item.gsis_id)
    if (!player) {
      result.players_not_matched++
      if (collector) {
        collector.add_player_issue({
          type: 'gsisid_not_found',
          player_name: null,
          team: null,
          identifier: item.gsis_id,
          source: 'espn_rtm'
        })
      }
      continue
    }

    const player_seasonlogs_insert = {
      pid: player.pid,
      year: item.min_season,
      pos: player.primary_position,
      seas_type: 'REG',
      espn_rtm_routes: item.rtm_routes,
      espn_rtm_targets: item.rtm_targets,
      espn_rtm_recv_yds: item.yds,
      espn_overall_score: item.overall,
      espn_open_score: item.open_score,
      espn_catch_score: item.catch_score,
      espn_yac_score: item.yac_score
    }

    player_seasonlogs_inserts.push(player_seasonlogs_insert)
  }

  if (dry) {
    log(player_seasonlogs_inserts[0])
    result.players_updated = player_seasonlogs_inserts.length
    return result
  }

  if (player_seasonlogs_inserts.length) {
    log(
      `inserting ${player_seasonlogs_inserts.length} player_seasonlogs records`
    )
    await db('player_seasonlogs')
      .insert(player_seasonlogs_inserts)
      .onConflict(['pid', 'year', 'seas_type'])
      .merge()

    const espn_receiving_metrics_inserts = player_seasonlogs_inserts.map(
      (i) => ({
        pid: i.pid,
        season_year: i.year,
        pos: i.pos,
        season_type: i.seas_type,
        espn_rtm_routes: i.espn_rtm_routes,
        espn_rtm_targets: i.espn_rtm_targets,
        espn_rtm_recv_yds: i.espn_rtm_recv_yds,
        espn_overall_score: i.espn_overall_score,
        espn_open_score: i.espn_open_score,
        espn_catch_score: i.espn_catch_score,
        espn_yac_score: i.espn_yac_score,
        observed_at
      })
    )

    await db('espn_receiving_metrics_history')
      .insert(espn_receiving_metrics_inserts)
      .onConflict(['pid', 'season_year', 'season_type', 'observed_at'])
      .merge()

    result.players_updated = player_seasonlogs_inserts.length
    log('completed')
  }

  if (collector) {
    collector.set_stats({
      players_updated: result.players_updated
    })
  }

  return result
}

// Unbounded run (no --year) processes RTM data across all historical years
// — typically thousands of player_seasonlogs records. 200 catches the
// silent failure mode where the S3 JSON is fetched but gsisid lookups all
// fail (e.g., player table schema drift), leaving players_updated=0 with
// no thrown error.
const RTM_PLAYERS_UPDATED_FLOOR_UNBOUNDED = 200

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await import_espn_receiving_tracking_metrics({
      year: argv.year,
      force_download: argv.force_download,
      dry: argv.dry,
      file_path: argv.file_path
    })
    console.log(
      `=== SUMMARY === ${JSON.stringify({ script: 'import-espn-receiving-tracking-metrics', year: argv.year || 'all', ...result })}`
    )

    throw_if_shortfall(
      !argv.year &&
        !argv.dry &&
        result.players_updated < RTM_PLAYERS_UPDATED_FLOOR_UNBOUNDED
        ? `import-espn-receiving-tracking-metrics shortfall: players_updated=${result.players_updated} (floor=${RTM_PLAYERS_UPDATED_FLOOR_UNBOUNDED} for unbounded run); players_not_matched=${result.players_not_matched}`
        : null
    )
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_ESPN_RECEIVING_TRACKING_METRICS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_espn_receiving_tracking_metrics
