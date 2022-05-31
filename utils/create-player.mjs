import debug from 'debug'

import { constants, formatHeight, fixTeam } from '#common'
import db from '#db'
import generatePlayerId from './generate-player-id.mjs'
import * as espn from './espn.mjs'
import * as sportradar from './sportradar.mjs'

const log = debug('create-player')
debug.enable('create-player')

/*
   player
   fname
   lname
   pname
   pos
   pos1
   height
   weight
   col
   start
   cteam
   posd
   jnum

   dpos 0
   dcp 0
*/

const createPlayer = async (player) => {
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

        if (!player.start) {
          if (sportradarPlayer.draft) {
            player.start = sportradarPlayer.draft.year
          } else if (sportradarPlayer.seasons.length) {
            const seasons = sportradarPlayer.seasons.map((s) => s.year)
            player.start = Math.min(...seasons)
          }
        }
      } catch (e) {
        log(e)
      }
    }
  }

  player.height = formatHeight(player.height)
  player.cteam = fixTeam(player.cteam)

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

    log(`Created player: ${playerId}`)
  } catch (error) {
    log('Unable to create player')
    log(error)
    log(player)
    return null
  }

  return player
}

export default createPlayer
