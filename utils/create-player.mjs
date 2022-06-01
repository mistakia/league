import debug from 'debug'

import { constants, formatHeight, formatPlayerName, fixTeam } from '#common'
import db from '#db'
import generatePlayerId from './generate-player-id.mjs'
import * as espn from './espn.mjs'
import * as sportradar from './sportradar.mjs'

const IS_PROD = process.env.NODE_ENV === 'production'
const log = debug('create-player')
debug.enable('create-player')

/*
   fname
   lname
   dob
   start

   pos
   pos1
   posd

   cteam

   height
   weight

   col

   dpos 0
   dcp 0
   jnum 0
 */

const required = [
  'fname',
  'lname',
  'dob',
  'start',
  'pos',
  'pos1',
  'height',
  'weight',
  'col',
  'posd'
]

const createPlayer = async (player) => {
  const playerId = await generatePlayerId(player)

  if (!player.start) {
    const { espn_id, sportradar_id } = player
    if (espn_id) {
      const espnPlayer = await espn.getPlayer({ espn_id })
      player.start = espnPlayer.athlete.debutYear
    }

    if (IS_PROD && !player.start && sportradar_id) {
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

  for (const field of required) {
    if (!player[field]) {
      log(`Unable to create player, missing ${field} field`)
      log(player)
      return null
    }
  }

  player.pname = `${player.fname.charAt(0).toUpperCase()}.${player.lname}`
  player.formatted = formatPlayerName(`${player.fname} ${player.lname}`)
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
