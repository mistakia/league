import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, fixTeam } from '#common'
import { isMain, getPlayer, updatePlayer, createPlayer } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-sleeper-players')
debug.enable('import-sleeper-players,update-player,add-player')
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const missing = []

  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch(URL).then((res) => res.json())

  const fields = {}
  const updates = []
  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team)
    const pos = item.position

    if (!name || !pos) continue

    for (const field in item) {
      fields[field] = true
    }

    let player
    try {
      player = await getPlayer({ sleeper_id })
      if (!player) {
        missing.push(item)
        continue
      }
    } catch (err) {
      console.log(err)
      continue
    }

    const {
      rotoworld_id,
      high_school,
      rotowire_id,
      gsis_id,
      sportradar_id,
      // practice_description,
      espn_id,
      fantasy_data_id,
      yahoo_id,
      // practice_participation,
      // stats_id,
      status,
      injury_status
    } = item

    const data = {
      rotoworld_id,
      high_school,
      rotowire_id,
      gsisid: gsis_id ? gsis_id.trim() : null,
      sportradar_id,
      // practice_description,
      espn_id,
      fantasy_data_id,
      yahoo_id,
      // practice_participation,
      // stats_global_id: stats_id,
      status,
      injury_status,
      sleeper_id,
      player: player.player,
      // name,
      cteam: team
      // pos
    }

    updates.push(data)
  }

  if (argv.dry) {
    log(updates[0])
    return
  }

  log(`Updating data for ${updates.length} players`)
  const sleeperIds = updates.map((p) => p.sleeper_id)

  const currentPlayers = await db('player').whereIn('sleeper_id', sleeperIds)

  let editCount = 0
  for (const player of currentPlayers) {
    const update = updates.find((r) => r.sleeper_id === player.sleeper_id)
    const edits = await updatePlayer({ player, update })
    editCount += edits
  }

  log(`updated ${editCount} player fields`)

  log(`Could not locate ${missing.length} players`)
  for (const item of missing) {
    if (!constants.positions.includes(item.position)) continue
    if (item.first_name === 'Duplicate') continue
    // log(`adding player: ${item.full_name} / ${item.position} / ${item.team}`)
    const player = {
      fname: item.first_name,
      lname: item.last_name,
      pname: `${item.first_name.charAt(0).toUpperCase()}.${item.last_name}`,
      pos: item.position,
      pos1: item.position,
      height: item.height,
      weight: item.weight,
      dob: item.birth_date,
      col: item.college,
      cteam: fixTeam(item.team),
      jnum: item.number,

      rotoworld_id: item.rotoworld_id,
      high_school: item.high_school,
      rotowire_id: item.rotowire_id,
      gsisid: item.gsis_id ? item.gsis_id.trim() : null,
      sportradar_id: item.sportradar_id,
      espn_id: item.espn_id,
      fantasy_data_id: item.fantasy_data_id,
      yahoo_id: item.yahoo_id,
      status: item.status,
      injury_status: item.injury_status,
      sleeper_id: item.player_id
    }

    await createPlayer(player)
  }

  const statuses = []
  for (const update of updates) {
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

      player,
      sleeper_id
    } = update

    if (!injury_status) continue

    statuses.push({
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

      player,
      sleeper_id,
      timestamp
    })
  }

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
    type: constants.jobs.PLAYERS_SLEEPER,
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
