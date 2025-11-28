import { isSlotActive } from '@libs-shared'
import { roster_slot_types } from '@constants'

/**
 * Filter available players to show only those that can resolve roster limit issues
 * @param {Object} params - The parameters object
 * @param {Array} params.all_available_players - All players available for release
 * @param {boolean} params.is_trade_valid - Whether the trade is currently valid
 * @param {Object} params.validation_details - Validation details including needs_active_releases and needs_ps_releases
 * @returns {Array} Filtered array of players that can be released to resolve roster limits
 */
export function filter_available_release_players({
  all_available_players,
  is_trade_valid,
  validation_details
}) {
  return all_available_players.filter((player) => {
    if (is_trade_valid) {
      return true
    }

    const player_slot = player.get('slot')
    const is_active_roster_player = isSlotActive(player_slot)
    const is_signed_practice_squad_player =
      player_slot === roster_slot_types.PS ||
      player_slot === roster_slot_types.PSP

    const needs_active_release =
      validation_details.needs_active_releases && is_active_roster_player
    const needs_ps_release =
      validation_details.needs_ps_releases && is_signed_practice_squad_player

    return needs_active_release || needs_ps_release
  })
}
