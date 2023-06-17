import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import { isMain, getPlayer, updatePlayer, createPlayer } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-sleeper')
debug.enable('import-players-sleeper,update-player,create-player,get-player')
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch(URL).then((res) => res.json())

  const statuses = []
  const fields = {}
  let changeCount = 0

  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team)
    const pos = item.position

    if (!name || !pos) continue

    for (const field in item) {
      fields[field] = true
    }

    let player_row
    try {
      player_row = await getPlayer({ sleeper_id })
      if (!player_row) {
        player_row = await getPlayer({ name, pos, team })
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
      status,
      injury_status,
      sleeper_id,
      cteam: team
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
          cteam: item.team,
          jnum: item.number,

          posd: item.position,

          ...data
        })
      } catch (err) {
        log(err)
      }
    } else {
      const changes = await updatePlayer({
        player_row,
        update: data
      })
      changeCount += changes
    }

    if (!player_row || !injury_status) continue

    statuses.push({
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
    })
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

  await db('jobs').insert({
    type: constants.jobs.IMPORT_PLAYERS_SLEEPER,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
