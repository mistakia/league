/* eslint camelcase: 'off' */
// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')

const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:players:sleeper')
debug.enable('league:player:get,import:players:sleeper')

const { getPlayerId, fixTeam } = require('../utils')
const db = require('../db')
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const missing = []

  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch(URL).then(res => res.json())

  const fields = {}
  const inserts = []
  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team || '')
    const pos = item.position

    if (!name || !team || !pos) continue

    const params = { name, team, pos }
    let playerId
    try {
      playerId = await getPlayerId(params)
      if (!playerId) {
        missing.push(params)
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    for (const field in item) {
      fields[field] = true
    }

    const {
      rotoworld_id,
      high_school,
      injury_notes,
      rotowire_id,
      gsis_id,
      sportradar_id,
      practice_description,
      espn_id,
      fantasy_data_id,
      yahoo_id,
      injury_start_date,
      practice_participation,
      search_rank,
      injury_body_part,
      stats_id,
      injury_status,
      status
    } = item

    const data = {
      rotoworld_id,
      high_school,
      injury_notes,
      rotowire_id,
      gsis_id,
      sportradar_id,
      practice_description,
      espn_id,
      fantasy_data_id,
      yahoo_id,
      injury_start_date,
      practice_participation,
      search_rank,
      injury_body_part,
      stats_global_id: stats_id,
      injury_status,
      status,
      sleeper_id,
      player: playerId,
      name,
      team,
      pos
    }

    inserts.push(data)
  }

  log(`Complete field list: ${Object.keys(fields)}`)
  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    return process.exit()
  }

  log(`Inserting ${inserts.length} players into database`)
  for (const insert of inserts) {
    const rows = await db('players').where('sleeper_id', insert.sleeper_id)
    if (rows.length) {
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
        search_rank
      } = insert
      await db('players').update({
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
        search_rank
      }).where('sleeper_id', insert.sleeper_id)
    } else {
      await db('players').insert(insert)
    }
  }

  const statuses = []
  for (const insert of inserts) {
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
    } = insert

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

  await db('players_status').insert(statuses)

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
