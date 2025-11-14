import * as constants from './constants.mjs'
import isReserveEligible from './is-reserve-eligible.mjs'

/**
 * Validate that a player can be assigned to a specific slot
 *
 * @param {Object} params - The parameters object
 * @param {Object} params.player - Player object with nfl_status, injury_status, pos, etc.
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
  if (slot === constants.slots.BENCH) {
    const has_space = roster.hasOpenBenchSlot(player.pos)
    return {
      valid: has_space,
      error: has_space
        ? null
        : 'No active roster space available for this position',
      requires_release: !has_space
    }
  }

  // Validate signed practice squad slots (PS, PSP converted to PS)
  if (slot === constants.slots.PS || slot === constants.slots.PSP) {
    const has_space = roster.hasOpenPracticeSquadSlot()
    return {
      valid: has_space,
      error: has_space ? null : 'No practice squad space available',
      requires_release: !has_space
    }
  }

  // Validate drafted practice squad slots (PSD, PSDP)
  // These have unlimited space, so always valid
  if (slot === constants.slots.PSD || slot === constants.slots.PSDP) {
    return {
      valid: true,
      error: null,
      requires_release: false
    }
  }

  // Validate short-term reserve slot
  if (slot === constants.slots.RESERVE_SHORT_TERM) {
    // First check if player is reserve eligible
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
  if (slot === constants.slots.RESERVE_LONG_TERM) {
    return {
      valid: true,
      error: null,
      requires_release: false
    }
  }

  // Validate COV slot (COVID reserve)
  if (slot === constants.slots.COV) {
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
