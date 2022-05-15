import debug from 'debug'

import { constants } from '#common'
import db from '#db'
import generatePlayerId from './generate-player-id.mjs'
import * as espn from './espn.mjs'
import * as sportradar from './sportradar.mjs'

const log = debug('update-player')
debug.enable('update-player')

const addPlayer = async (player) => {
  const playerId = await generatePlayerId(player)

  if (!player.start) {
    const { espn_id, sportradar_id } = player
    if (espn_id) {
      const espnPlayer = await espn.getPlayer({ espn_id })
      player.start = espnPlayer.athlete.debutYear
    }

    if (!player.start && sportradar_id) {
      try {
        const sportradarPlayer = await sportradar.getPlayer({ sportradar_id })
        player.start = sportradarPlayer.rookie_year
      } catch (e) {
        log(e)
      }
    }
  }

  try {
    await db('player').insert({
      player: playerId,
      ...player
    })

    await db('player_changelog').insert({
      type: constants.changes.PLAYER_NEW,
      id: playerId,
      timestamp: Math.round(Date.now() / 1000)
    })
  } catch (error) {
    log('Unable to create player')
    log(error)
    log(player)
    return null
  }

  return player
}

export default addPlayer
