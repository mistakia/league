import debug from 'debug'
import fs from 'fs-extra'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import os from 'os'
import fetch from 'node-fetch'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-espn-receiving-tracking-metrics')
debug.enable('import-espn-receiving-tracking-metrics')

const import_espn_receiving_tracking_metrics = async ({
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
    fs.writeJsonSync(path, json_data)
  } else {
    log(`file exists: ${path}`)
    json_data = fs.readJsonSync(path)
  }

  const single_season_data = json_data.filter(
    (item) => item.min_season === item.max_season
  )

  log(`single_season_data length: ${single_season_data.length}`)

  const players = await db('player').select('pid', 'gsisid', 'pos')
  const player_seasonlogs_inserts = []
  const timestamp = Math.round(Date.now() / 1000)

  for (const item of single_season_data) {
    const player = players.find((p) => p.gsisid === item.gsis_id)
    if (!player) {
      log(`player not found: ${item.gsis_id}`)
      log(item)
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
      pos: player.pos,
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

    await db('espn_receiving_metrics_history')
      .insert(player_seasonlogs_inserts.map((i) => ({ ...i, timestamp })))
      .onConflict(['pid', 'year', 'seas_type', 'timestamp'])
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

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_espn_receiving_tracking_metrics({
      force_download: argv.force_download,
      dry: argv.dry,
      file_path: argv.file_path
    })
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
