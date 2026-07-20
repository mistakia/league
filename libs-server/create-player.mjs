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

const required = ['fname', 'lname', 'pos', 'pos1', 'height', 'weight', 'posd']

const createPlayer = async (playerData) => {
  for (const field of required) {
    if (!playerData[field]) {
      log(`Unable to create player, missing ${field} field`)
      log(playerData)
      return null
    }
  }

  // Draw the immutable opaque serial from the dedicated sequence and compose the pid.
  // DST pseudo-rows take the team abbreviation and consume no serial.
  let serial
  if (playerData.pos !== 'DST') {
    const result = await db.raw(
      "SELECT nextval('player_pid_serial_seq') AS serial"
    )
    serial = result.rows[0].serial
  }

  const playerId = generate_player_id({ ...playerData, serial })

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
  playerData.roster_status = format_nfl_status(playerData.roster_status)

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
