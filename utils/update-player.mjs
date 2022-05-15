import diff from 'deep-diff'
import debug from 'debug'

import { constants } from '#common'
import db from '#db'

const log = debug('update-player')
debug.enable('update-player')

const uniques = [
  'esbid',
  'gsisid',
  'gsispid',
  'sleeper_id',
  'rotoworld_id',
  'rotowire_id',
  'sportradar_id',
  'espn_id',
  'fantasy_data_id',
  'yahoo_id',
  'keeptradecut_id'
]

const updatePlayer = async ({ player, update }) => {
  const differences = diff(player, update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    if (!edit.rhs) {
      continue
    }

    const prop = edit.path[0]

    if (uniques.includes(prop)) {
      const exists = await db('player').where(prop, edit.rhs).limit(1)
      if (exists.length) {
        log(
          `Player (${exists[0].player}) has existing value (${edit.rhs}) for field (${prop})`
        )
        continue
      }
    }

    changes += 1
    // log(`Player: ${player.player}, Field: ${prop}, Value: ${edit.rhs}`)
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

  return changes
}

export default updatePlayer
