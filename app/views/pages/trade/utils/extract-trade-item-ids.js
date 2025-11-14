/**
 * Extract player IDs and pick IDs from trade items array
 * @param {Array} items - Array of trade items with type and id properties
 * @returns {Object} Object with player_ids and pick_ids arrays
 */
export function extract_trade_item_ids(items) {
  const players = items.filter((item) => item.type === 'player')
  const picks = items.filter((item) => item.type === 'pick')

  const player_ids = players.map((player) => player.id)
  const pick_ids = picks.map((pick) => pick.pickId)

  return { player_ids, pick_ids }
}
