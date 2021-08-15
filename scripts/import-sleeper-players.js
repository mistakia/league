/* eslint camelcase: 'off' */
// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')
const diff = require('deep-diff')

const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:players:sleeper')
debug.enable('league:player:get,import:players:sleeper')

const { getPlayerId } = require('../utils')
const { constants, fixTeam } = require('../common')
const db = require('../db')
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const missing = []

  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch(URL).then((res) => res.json())

  const fields = {}
  const inserts = []
  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team)
    const pos = item.position

    if (!name || !pos) continue

    for (const field in item) {
      fields[field] = true
    }

    const params = { name, pos }
    let playerId
    try {
      playerId = await getPlayerId(params)
      if (!playerId) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
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
      gsisid: gsis_id,
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
      player: playerId,
      // name,
      cteam: team
      // pos
    }

    inserts.push(data)
  }

  log(`Complete field list: ${Object.keys(fields)}`)
  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => {
    if (!constants.positions.includes(m.pos)) return
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  })

  if (argv.dry) {
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} players into database`)
  const playerIds = inserts.map((p) => p.player)
  const sleeperIds = inserts.map((p) => p.sleeper_id)

  const currentPlayers = await db('player')
    .whereIn('player', playerIds)
    .orWhereIn('sleeper_id', sleeperIds)
  // const currentPlayerIds = currentPlayers.map((p) => p.player)

  for (const player of currentPlayers) {
    const row = inserts.find(
      (r) => r.player === player.player || r.sleeper_id === player.sleeper_id
    )
    const differences = diff(player, row)

    const edits = differences.filter((d) => d.kind === 'E')
    if (edits.length) {
      for (const edit of edits) {
        const prop = edit.path[0]
        log(`Updating ${player.player} - ${prop} - ${edit.rhs}`)
        await db('changelog').insert({
          type: constants.changes.PLAYER_EDIT,
          id: player.player,
          prop,
          prev: edit.lhs,
          new: edit.rhs,
          timestamp
        })

        await db('player')
          .update({
            [prop]: edit.rhs
          })
          .where({
            player: player.player
          })
      }
    }
  }

  // TODO - create new players
  /* const missingPlayerIds = playerIds.filter(
   *   (p) => !currentPlayerIds.includes(p)
   * )

   * for (const missingPlayerId of missingPlayerIds) {
   *   const row = inserts.find((r) => r.player === missingPlayerId)
   *   await db('changelog').insert({
   *     type: constants.changes.PLAYER_NEW,
   *     id: row.player,
   *     timestamp
   *   })

   *   await db('player').insert({
   *     pos: row.pos1,
   *     ...formatted
   *   })
   * }
   *
   * for (const insert of inserts) {
   *   const rows = await db('players').where('sleeper_id', insert.sleeper_id)
   *   if (rows.length) {
   *     const {
   *       active,
   *       depth_chart_order,
   *       depth_chart_position,
   *       injury_body_part,
   *       injury_start_date,
   *       injury_status,
   *       injury_notes,
   *       practice_participation,
   *       practice_description,
   *       status,
   *       search_rank
   *     } = insert
   *     await db('players')
   *       .update({
   *         active,
   *         depth_chart_order,
   *         depth_chart_position,
   *         injury_body_part,
   *         injury_start_date,
   *         injury_status,
   *         injury_notes,
   *         practice_participation,
   *         practice_description,
   *         status,
   *         search_rank
   *       })
   *       .where('sleeper_id', insert.sleeper_id)
   *   } else {
   *     await db('players').insert(insert)
   *   }
   * } */

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
}

module.exports = run

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

if (!module.parent) {
  main()
}
