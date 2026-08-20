import debug from 'debug'

import {
  formatHeight,
  format_player_name,
  fixTeam,
  format_nfl_status
} from '#libs-shared'
import { normalize_position } from '#libs-shared/constants/position-constants.mjs'
import db from '#db'
import { is_implausible_entry_age } from './player-era.mjs'
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

  /*
    Cross-field plausibility, and it DROPS the draft year rather than refusing
    the row. Every other identity guard reads a candidate against EXISTING rows,
    so a source record that contradicts itself on one line -- Sleeper's 2933
    carries birth_date 1989-10-13 and rookie_year 2025 -- passes all of them and
    mints a fresh pid holding the contradiction (CORE-KNOX-044391).

    Refusing the person instead would be the worse error, and the band says so:
    the conflated-row audit treats a breach as worth a human READING, not as
    proof, so a genuine late entry would be kept out of the table permanently and
    re-refused nightly. `nfl_draft_year` is also the field that lies when two
    pieces of evidence disagree (see player-era.mjs), and a null draft year is a
    shape every caller already writes for a source that carries none -- so this
    degrades to the state a human adjudication reached on that exact row.
  */
  if (is_implausible_entry_age(playerData)) {
    log(
      `Dropping implausible nfl_draft_year ${playerData.nfl_draft_year} against date_of_birth ${playerData.date_of_birth} for ${playerData.first_name} ${playerData.last_name}`
    )
    playerData.nfl_draft_year = null
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
