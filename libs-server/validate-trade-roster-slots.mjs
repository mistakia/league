import validate_trade_slot_assignment from '#libs-shared/validate-trade-slot-assignment.mjs'

/**
 * Validate slot assignments for a team receiving players in a trade
 *
 * All slot assignments must be provided by the client. The server only validates
 * that the assigned slots are valid and available.
 *
 * @param {Object} params - The parameters object
 * @param {Array<string>} params.incoming_player_ids - PIDs of players this team will receive
 * @param {Array<Object>} params.player_rows - Player data rows with full player info
 * @param {Object} params.slot_assignments - Map of pid to assigned slot (required for all players)
 * @param {Object} params.roster - Roster object for the receiving team
 * @param {number} params.week - Current week number
 * @param {boolean} params.is_regular_season - Whether it's regular season
 * @param {Object} params.player_extensions - Optional map of pid to extension count
 * @returns {Array<Object>} Array of validation errors with { pid, slot, error }, empty if all valid
 */
export default function validate_trade_roster_slots({
  incoming_player_ids,
  player_rows,
  slot_assignments,
  roster,
  week,
  is_regular_season,
  player_extensions = {}
}) {
  const validation_errors = []

  for (const pid of incoming_player_ids) {
    const player_row = player_rows.find((p) => p.pid === pid)
    if (!player_row) {
      validation_errors.push({
        pid,
        error: `Player ${pid} not found`
      })
      continue
    }

    // Require slot assignment from client
    const assigned_slot = slot_assignments[pid]
    if (assigned_slot === undefined) {
      validation_errors.push({
        pid,
        error: `No slot assignment provided for player ${pid}`
      })
      continue
    }

    // Validate the slot assignment
    const validation_result = validate_trade_slot_assignment({
      player: player_row,
      slot: assigned_slot,
      roster,
      week,
      is_regular_season
    })

    if (!validation_result.valid) {
      validation_errors.push({
        pid,
        slot: assigned_slot,
        error: validation_result.error
      })
    } else {
      // Add player to roster simulation for next validation
      roster.addPlayer({
        slot: assigned_slot,
        pid,
        pos: player_row.pos,
        value: player_row.value,
        extensions: player_extensions[pid] || 0
      })
    }
  }

  return validation_errors
}
