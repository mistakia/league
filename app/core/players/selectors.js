export function getPlayers (state) {
  return state.get('players').get('items').toList()
}
