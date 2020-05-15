export function getPlayers (state) {
  const players = state.get('players')
  const items = players.get('items')
  const positions = players.get('positions')
  const filtered = items.filter(player => positions.includes(player.pos))
  return filtered.toList()
}

export function getPlayerPositionFilter (state) {
  return state.get('players').get('positions')
}
