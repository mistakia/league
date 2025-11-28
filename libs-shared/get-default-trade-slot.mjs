import { roster_slot_types } from '#constants'
import isReserveEligible from './is-reserve-eligible.mjs'

/**
 * Calculate intelligent default slot for incoming traded player
 *
 * Priority order:
 * 1. Drafted PS players (PSD/PSDP) → PSD (unprotected, unlimited space)
 * 2. Reserve-eligible players → RESERVE_SHORT_TERM (requires eligibility check)
 * 3. Signed PS players (PS/PSP) → PS (unprotected, requires space validation)
 * 4. All others → BENCH (active roster)
 *
 * @param {Object} params - The parameters object
 * @param {Object} params.player - Player object with nfl_status, injury_status, etc.
 * @param {number} params.current_slot - Player's current slot
 * @param {Object} params.roster - Roster object for space validation
 * @param {number} params.week - Current week number
 * @param {boolean} params.is_regular_season - Whether it's regular season
 * @returns {number} The recommended slot constant
 */
export default function get_default_trade_slot({
  player,
  current_slot,
  roster,
  week,
  is_regular_season
}) {
  // Priority 1: Drafted practice squad players default to unprotected drafted PS
  // Convert protected PSDP to unprotected PSD, or keep PSD as PSD
  if (
    current_slot === roster_slot_types.PSD ||
    current_slot === roster_slot_types.PSDP
  ) {
    return roster_slot_types.PSD
  }

  // Priority 2: Reserve-eligible players default to short-term IR (if space available)
  // Check if player is eligible for reserve based on injury/NFL status
  const player_is_reserve_eligible = isReserveEligible({
    nfl_status: player.nfl_status,
    injury_status: player.injury_status,
    practice: player.practice,
    week,
    is_regular_season,
    game_day: player.game_day,
    prior_week_inactive: player.prior_week_inactive,
    prior_week_ruled_out: player.prior_week_ruled_out
  })

  if (player_is_reserve_eligible && roster.has_open_reserve_short_term_slot()) {
    return roster_slot_types.RESERVE_SHORT_TERM
  }

  // Priority 3: Signed practice squad players default to unprotected signed PS (if space available)
  // Convert protected PSP to unprotected PS, or keep PS as PS
  if (
    (current_slot === roster_slot_types.PS ||
      current_slot === roster_slot_types.PSP) &&
    roster.has_practice_squad_space_for_position(player.pos)
  ) {
    return roster_slot_types.PS
  }

  // Priority 4: Default to active roster bench for all other cases
  return roster_slot_types.BENCH
}
