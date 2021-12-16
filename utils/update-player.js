const diff = require('deep-diff')
const debug = require('debug')

const log = debug('update-player')
debug.enable('update-player')

const { constants } = require('../common')
const db = require('../db')

const updatePlayer = async ({ player, update }) => {
  const differences = diff(player, update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  for (const edit of edits) {
    const prop = edit.path[0]
    log(`Player: ${player.player}, Field: ${prop}, Value: ${edit.rhs}`)
    await db('player_changelog').insert({
      type: constants.changes.PLAYER_EDIT,
      id: player.player,
      prop,
      prev: edit.lhs,
      new: edit.rhs,
      timestamp: Math.round(Date.now() / 1000)
    })

    await db('player')
      .update({
        [prop]: edit.rhs
      })
      .where({
        player: player.player
      })
  }

  return edits.length
}

module.exports = updatePlayer
