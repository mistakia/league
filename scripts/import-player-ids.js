// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const path = require('path')

const db = require('../db')
const { readCSV, getPlayerId } = require('../utils')
const { constants } = require('../common')

const log = debug('import:nfl:player:ids')
debug.enable('import:nfl:player:ids')

const run = async () => {
  const filepath = path.resolve(__dirname, '../data/players.csv')
  const rows = await readCSV(filepath)

  const timestamp = Math.round(Date.now() / 1000)
  const missing = []
  const multiple = []

  for (const row of rows) {
    let playerId
    try {
      playerId = await getPlayerId({ name: row.full_player_name, pos: row.position })
    } catch (error) {
      if (error.message === 'matched multiple players') {
        multiple.push(row)
      } else {
        throw error
      }
    }

    if (!playerId) {
      missing.push(row)
      continue
    }

    const players = await db('player').where({ player: playerId })
    const player = players[0]
    if (!player.gsispid || player.gsispid !== row.player_id) {
      await db('changelog').insert({
        type: constants.changes.PLAYER_EDIT,
        id: playerId,
        prop: 'gsispid',
        prev: player.gsispid,
        new: row.player_id,
        timestamp
      })

      await db('player').update({
        gsispid: row.player_id
      }).where({ player: playerId })
    }
  }

  for (const item of multiple) {
    if (constants.positions.includes(item.position)) {
      log('matched multiple')
      log(item)
    }
  }

  for (const item of missing) {
    if (constants.positions.includes(item.position)) {
      log(item)
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
    type: constants.jobs.NFL_PLAYER_IDS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
