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
   first_name
   last_name
   date_of_birth
   nfl_draft_year

   primary_position
   secondary_position
   position_depth

   current_nfl_team

   height_inches
   weight_pounds

   college

   draft_overall_pick 0
   draft_capital_points 0
   jersey_number 0
 */

const required = [
  'first_name',
  'last_name',
  'primary_position',
  'secondary_position',
  'height_inches',
  'weight_pounds',
  'position_depth'
]

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
  if (playerData.primary_position !== 'DST') {
    const result = await db.raw(
      "SELECT nextval('player_pid_serial_seq') AS serial"
    )
    serial = result.rows[0].serial
  }

  const playerId = generate_player_id({ ...playerData, serial })

  playerData.short_name = `${playerData.first_name
    .match(/[a-zA-Z]/)
    .pop()
    .toUpperCase()}.${playerData.last_name}`
  playerData.formatted_name = format_player_name(
    `${playerData.first_name} ${playerData.last_name}`
  )
  playerData.height_inches = formatHeight(playerData.height_inches)
  playerData.current_nfl_team = fixTeam(playerData.current_nfl_team)
  playerData.primary_position = formatPosition(playerData.primary_position)
  playerData.secondary_position = formatPosition(playerData.secondary_position)
  playerData.position_depth = formatPosition(playerData.position_depth)
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
