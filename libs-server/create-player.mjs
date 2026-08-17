import debug from 'debug'

import {
  formatHeight,
  format_player_name,
  fixTeam,
  format_nfl_status
} from '#libs-shared'
import { normalize_position } from '#libs-shared/constants/position-constants.mjs'
import db from '#db'
import generate_player_id from './generate-player-id.mjs'

const log = debug('create-player')
// Library module: a bare debug.enable REPLACES the namespace set for the whole
// process, so importing this would silently switch off namespaces the entry
// point enabled. Defer to an explicit DEBUG (see jobs/import-live-odds-worker.mjs).
if (!process.env.DEBUG) {
  debug.enable('create-player')
}

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

/*
  Exported so a caller can evaluate the same predicate BEFORE calling and tell a
  REFUSAL apart from a FAILURE. createPlayer returns null for both, and a run
  oracle that cannot separate them either alarms nightly on permanently
  incomplete feed entries or stays silent on a real writer fault.

  Import this rather than copying the list. It is already hand-duplicated once at
  scripts/backfill-players-from-nflverse-weekly-rosters.mjs, and a third copy
  would drift.
*/
export const CREATE_PLAYER_REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'primary_position',
  'secondary_position',
  'height_inches',
  'weight_pounds',
  'position_depth'
]

const createPlayer = async (playerData) => {
  for (const field of CREATE_PLAYER_REQUIRED_FIELDS) {
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
  playerData.primary_position = normalize_position(playerData.primary_position)
  playerData.secondary_position = normalize_position(
    playerData.secondary_position
  )
  // position_depth is a depth-chart slot (INA, RWR, LCB, PK), not a roster
  // position, so it has its own vocabulary and is not normalized -- only cased.
  playerData.position_depth = playerData.position_depth
    ? playerData.position_depth.toUpperCase()
    : playerData.position_depth
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
