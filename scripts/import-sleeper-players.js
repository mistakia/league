/* eslint camelcase: 'off' */
// eslint-disable-next-line
require = require('esm')(module /*, options*/)
// const fetch = require('node-fetch')
const fetch = require('node-fetch-cache')('/tmp')
const diff = require('deep-diff')

const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:players:sleeper')
debug.enable('import:players:sleeper')

const { getPlayerId } = require('../utils')
const { constants, fixTeam } = require('../common')
const db = require('../db')
const timestamp = Math.round(Date.now() / 1000)

const getData = (item) => ({
  sleeperid: item.player_id,
  cteam: fixTeam(item.team) || 'INA',
  // dcp: item.depth_chart_order, // TODO
  // posd: item.depth_chart_position, // TODO
  // jnum: item.number,

  espnid: item.espn_id,
  fantasydataid: item.fantasy_data_id,
  rotoworldid: item.rotoworld_id,
  rotowireid: item.rotowire_id,
  statsglobalid: item.stats_id,
  sportradarid: item.sportradar_id,
  yahooid: item.yahoo_id,

  bcountry: item.birth_country,
  bstate: item.birth_state,
  bcity: item.birth_city,
  hs: item.high_school,
  status: item.status
})

const run = async () => {
  const missing = []

  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch(URL).then(res => res.json())

  const players = await db('player')
  const fields = {}
  const inserts = []
  for (const sleeperId in result) {
    const item = result[sleeperId]
    let player = players.find(p => p.sleeperid === sleeperId)
    if (!player) {
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

      player = players.find(p => p.player === playerId)
    }

    if (!player) continue

    for (const field in item) {
      fields[field] = true
    }

    const data = getData(item)
    const differences = diff(player, data)
    const edits = differences.filter(d => d.kind === 'E')
    if (edits.length) {
      console.log(edits)
      console.log(item)
      console.log(player)
      for (const edit of edits) {
        const prop = edit.path[0]
        if (argv.dry) {
          continue
        }
        await db('changelog').insert({
          type: constants.changes.PLAYER_EDIT,
          id: player.player,
          prop,
          prev: edit.lhs,
          new: edit.rhs,
          timestamp
        })

        await db('player').update({
          [prop]: edit.rhs
        }).where({
          player: player.player
        })
      }
    }
  }

  // log(fields)
  log(`Could not locate ${missing.length} players`)
  // missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))
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
