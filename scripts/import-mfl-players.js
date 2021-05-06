/* eslint camelcase: 'off' */
// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')

const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:players:mfl')
debug.enable('league:player:get,import:players:mfl')

const { getPlayerId } = require('../utils')
const db = require('../db')
const config = require('../config')

const { constants, fixTeam } = require('../common')

const run = async () => {
  const missing = []

  const URL = `https://api.myfantasyleague.com/${constants.season.year}/export?TYPE=players&DETAILS=1&JSON=1`
  const result = await fetch(URL, {
    headers: {
      'User-Agent': config.mflUserAgent
    }
  }).then((res) => res.json())

  const fields = {}
  const inserts = []
  const ignorePositions = [
    'TMQB',
    'TMPK',
    'TMPN',
    'TMWR',
    'TMRB',
    'TMDL',
    'TMLB',
    'TMDB',
    'TMTE',
    'ST',
    'Off'
  ]
  for (const item of result.players.player) {
    const name = item.name.split(', ').reverse().join(' ')
    const team = fixTeam(item.team)
    const pos = item.position

    if (ignorePositions.includes(pos)) {
      continue
    }

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
      cbs_id,
      espn_id,
      fleaflicker_id,
      nfl_id,
      id, // mfl_id
      rotoworld_id,
      rotowire_id,
      stats_id,
      stats_global_id,
      sportsdata_id,
      twitter_username
    } = item

    const data = {
      cbs_id,
      espn_id,
      fleaflicker_id,
      nfl_id,
      mfl_id: id, // mfl_id
      rotoworld_id,
      rotowire_id,
      stats_id,
      stats_global_id,
      sportradar_id: sportsdata_id,
      twitter_username
    }

    inserts.push({
      player: playerId,
      name,
      team,
      pos,
      ...data
    })
  }

  log(`Complete field list: ${Object.keys(fields)}`)
  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    return
  }

  log(`Inserting ${inserts.length} players into database`)
  for (const insert of inserts) {
    const rows = await db('players').where('mfl_id', insert.mfl_id)
    if (rows.length) {
      const { twitter_username } = insert
      if (!twitter_username) continue
      await db('players')
        .update({ twitter_username })
        .where('mfl_id', insert.mfl_id)
    } else {
      await db('players').insert(insert)
    }
  }
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
    type: constants.jobs.PLAYERS_MFL,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
