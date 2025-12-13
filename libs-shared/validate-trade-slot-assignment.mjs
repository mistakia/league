import { roster_slot_types } from '#constants'
import isReserveEligible from './is-reserve-eligible.mjs'

/**
 * Validate that a player can be assigned to a specific slot
 *
 * @param {Object} params - The parameters object
 * @param {Object} params.player - Player object with roster_status, game_designation, pos, etc.
 * @param {number} params.slot - Target slot constant
 * @param {Object} params.roster - Roster object for space validation
 * @param {number} params.week - Current week number
 * @param {boolean} params.is_regular_season - Whether it's regular season
 * @returns {Object} Validation result { valid: boolean, error: string | null, requires_release: boolean }
 */
export default function validate_trade_slot_assignment({
  player,
  slot,
  roster,
  week,
  is_regular_season
}) {
  // Validate BENCH (active roster) slot
  if (slot === roster_slot_types.BENCH) {
    const has_space = roster.has_bench_space_for_position(player.pos)
    return {
      valid: has_space,
      error: has_space
        ? null
        : 'No active roster space available for this position',
      requires_release: !has_space
    }
  }

  // Validate signed practice squad slots (PS, PSP converted to PS)
  if (slot === roster_slot_types.PS || slot === roster_slot_types.PSP) {
    const has_space = roster.has_practice_squad_space_for_position(player.pos)
    return {
      valid: has_space,
      error: has_space
        ? null
        : 'No practice squad space available or position limit exceeded',
      requires_release: !has_space
    }
  }

  // Validate drafted practice squad slots (PSD, PSDP)
  // These have unlimited space, so always valid
  if (slot === roster_slot_types.PSD || slot === roster_slot_types.PSDP) {
    return {
      valid: true,
      error: null,
      requires_release: false
    }
  }

  // Validate short-term reserve slot
  if (slot === roster_slot_types.RESERVE_SHORT_TERM) {
    // First check if player is reserve eligible
    const player_is_reserve_eligible = isReserveEligible({
      roster_status: player.roster_status,
      game_designation: player.game_designation,
      practice: player.practice,
      week,
      is_regular_season,
      game_day: player.game_day,
      prior_week_inactive: player.prior_week_inactive,
      prior_week_ruled_out: player.prior_week_ruled_out
    })

    if (!player_is_reserve_eligible) {
      return {
        valid: false,
        error: 'Player is not eligible for short-term reserve',
        requires_release: false
      }
    }

    // Check if there's space
    const has_space = roster.has_open_reserve_short_term_slot()
    return {
      valid: has_space,
      error: has_space ? null : 'No short-term reserve space available',
      requires_release: false // Reserve slots don't require releases
    }
  }

  // Validate long-term reserve slot (unlimited space)
  if (slot === roster_slot_types.RESERVE_LONG_TERM) {
    return {
      valid: true,
      error: null,
      requires_release: false
    }
  }

  // Validate COV slot (COVID reserve)
  if (slot === roster_slot_types.COV) {
    return {
      valid: true,
      error: null,
      requires_release: false
    }
  }

  // Trades only support BENCH, PS, PSD, and RESERVE slots
  // Starting slots are not allowed for traded players
  return {
    valid: false,
    error: `Invalid slot for trade: ${slot}. Only BENCH, PS, PSD, and RESERVE slots are supported.`,
    requires_release: false
  }
}
