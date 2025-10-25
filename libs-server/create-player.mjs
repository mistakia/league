import debug from 'debug'

import {
  formatHeight,
  format_player_name,
  fixTeam,
  formatPosition,
  format_nfl_status
} from '#libs-shared'
import db from '#db'
import generate_player_id from './generate-player-id.mjs'
import * as espn from './espn.mjs'
import * as sportradar from './sportradar/index.mjs'

const IS_PROD = process.env.NODE_ENV === 'production'
const log = debug('create-player')
debug.enable('create-player')

/*
   fname
   lname
   dob
   nfl_draft_year

   pos
   pos1
   posd

   current_nfl_team

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
  'nfl_draft_year',
  'pos',
  'pos1',
  'height',
  'weight',
  'posd'
]

const createPlayer = async (playerData) => {
  const playerId = await generate_player_id(playerData)

  if (!playerData.nfl_draft_year) {
    const { espn_id, sportradar_id } = playerData
    if (espn_id) {
      const espnPlayer = await espn.getPlayer({ espn_id })
      playerData.nfl_draft_year = espnPlayer.athlete.debutYear
    }

    if (IS_PROD && !playerData.nfl_draft_year && sportradar_id) {
      try {
        const sportradarPlayer = await sportradar.getPlayer({ sportradar_id })
        playerData.nfl_draft_year = sportradarPlayer.rookie_year

        if (!playerData.nfl_draft_year) {
          if (sportradarPlayer.draft) {
            playerData.nfl_draft_year = sportradarPlayer.draft.year
          } else if (sportradarPlayer.seasons.length) {
            const seasons = sportradarPlayer.seasons.map((s) => s.year)
            playerData.nfl_draft_year = Math.min(...seasons)
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

  playerData.pname = `${playerData.fname
    .match(/[a-zA-Z]/)
    .pop()
    .toUpperCase()}.${playerData.lname}`
  playerData.formatted = format_player_name(
    `${playerData.fname} ${playerData.lname}`
  )
  playerData.height = formatHeight(playerData.height)
  playerData.current_nfl_team = fixTeam(playerData.current_nfl_team)
  playerData.pos = formatPosition(playerData.pos)
  playerData.pos1 = formatPosition(playerData.pos1)
  playerData.posd = formatPosition(playerData.posd)
  playerData.nfl_status = format_nfl_status(playerData.nfl_status)

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
