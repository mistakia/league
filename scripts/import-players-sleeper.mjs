import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  constants,
  fixTeam,
  format_nfl_status,
  format_nfl_injury_status
} from '#libs-shared'
import {
  is_main,
  find_player_row,
  updatePlayer,
  createPlayer,
  report_job,
  fetch_with_retry
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-sleeper')
debug.enable(
  'import-players-sleeper,update-player,create-player,get-player,fetch'
)
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch_with_retry({ url: URL, response_type: 'json' })

  const statuses = []
  const fields = {}
  let changeCount = 0

  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team)
    const pos = item.position
    const start = item.metadata?.start_year || null

    if (!name || !pos) continue

    for (const field in item) {
      fields[field] = true
    }

    let player_row
    try {
      player_row = await find_player_row({ sleeper_id })
      if (!player_row) {
        player_row = await find_player_row({
          name,
          pos,
          teams: [team, 'INA'],
          ignore_retired: true,
          start
        })
      }
    } catch (err) {
      log(err)
      log({ name, pos, team, sleeper_id })
      log(item)
      continue
    }

    const {
      active,
      depth_chart_order,
      depth_chart_position,
      injury_body_part,
      injury_start_date,
      injury_status,
      injury_notes,
      practice_participation,
      practice_description,
      status,
      search_rank,

      rotoworld_id,
      high_school,
      rotowire_id,
      gsis_id,
      sportradar_id,
      espn_id,
      fantasy_data_id,
      yahoo_id
      // stats_id,
    } = item

    const data = {
      rotoworld_id,
      high_school,
      rotowire_id,
      gsisid: gsis_id ? gsis_id.trim() : null,
      sportradar_id: sportradar_id || null,
      espn_id,
      fantasy_data_id,
      yahoo_id,
      // stats_global_id: stats_id,
      sleeper_id,
      current_nfl_team: team
    }

    // check to see if status matches injury status first
    try {
      data.injury_status = format_nfl_injury_status(injury_status)
    } catch (err) {
      log(err)
      log(item)
    }

    // injury status could be PUP which is an nfl status
    if (injury_status && !data.injury_status) {
      try {
        data.nfl_status = format_nfl_status(injury_status)
      } catch (err) {
        log(err)
        log(item)
      }
    } else if (!data.injury_status) {
      data.nfl_status = format_nfl_status(status)
    }

    if (!player_row) {
      if (!constants.positions.includes(item.position)) continue
      if (item.first_name === 'Duplicate' || item.first_name === 'Player')
        continue

      try {
        player_row = await createPlayer({
          fname: item.first_name,
          lname: item.last_name,
          pos: item.position,
          pos1: item.position,
          height: item.height,
          weight: item.weight,
          dob: item.birth_date,
          col: item.college,
          current_nfl_team: item.team,
          jnum: item.number,

          posd: item.position,
          start,

          ...data
        })
      } catch (err) {
        log(err)
        log(item)
      }
    } else {
      const changes = await updatePlayer({
        player_row,
        update: data
      })
      changeCount += changes
    }

    if (!player_row || !injury_status) continue

    const status_insert = {
      pid: player_row.pid,
      sleeper_id,

      active,
      depth_chart_order,
      depth_chart_position,
      injury_body_part,
      injury_start_date,
      injury_status,
      injury_notes,
      practice_participation,
      practice_description,
      status,
      search_rank,

      timestamp
    }

    try {
      status_insert.formatted_status = format_nfl_injury_status(injury_status)
    } catch (err) {
      log(err)
      log(item)
    }

    if (!status_insert.formatted_status) {
      try {
        status_insert.formatted_status = format_nfl_status(status)
      } catch (err) {
        log(err)
        log(item)
      }
    }

    statuses.push(status_insert)
  }

  log(`updated ${changeCount} player fields`)

  if (statuses.length) {
    await db('players_status').insert(statuses)
  }

  if (argv.fields) {
    log(`Complete field list: ${Object.keys(fields)}`)
  }
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_SLEEPER,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
