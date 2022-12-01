import debug from 'debug'

import { formatHeight, formatPlayerName, fixTeam } from '#common'
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

const createPlayer = async (playerData) => {
  const playerId = await generatePlayerId(playerData)

  if (!playerData.start) {
    const { espn_id, sportradar_id } = playerData
    if (espn_id) {
      const espnPlayer = await espn.getPlayer({ espn_id })
      playerData.start = espnPlayer.athlete.debutYear
    }

    if (IS_PROD && !playerData.start && sportradar_id) {
      try {
        const sportradarPlayer = await sportradar.getPlayer({ sportradar_id })
        playerData.start = sportradarPlayer.rookie_year

        if (!playerData.start) {
          if (sportradarPlayer.draft) {
            playerData.start = sportradarPlayer.draft.year
          } else if (sportradarPlayer.seasons.length) {
            const seasons = sportradarPlayer.seasons.map((s) => s.year)
            playerData.start = Math.min(...seasons)
          }
        }
      } catch (e) {
        log(e)
      }
    }
  }

  for (const field of required) {
    if (!playerData[field]) {
      log(`Unable to create player, missing ${field} field`)
      log(playerData)
      return null
    }
  }

  playerData.pname = `${playerData.fname.match(/[a-zA-Z]/).pop().toUpperCase()}.${
    playerData.lname
  }`
  playerData.formatted = formatPlayerName(
    `${playerData.fname} ${playerData.lname}`
  )
  playerData.height = formatHeight(playerData.height)
  playerData.cteam = fixTeam(playerData.cteam)

  try {
    await db('player').insert({
      pid: playerId,
      ...playerData
    })

    log(`Created player: ${playerId}`)
  } catch (error) {
    log('Unable to create player')
    log(error)
    log(playerData)
    return null
  }

  return { pid: playerId, ...playerData }
}

export default createPlayer
