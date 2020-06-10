import { constants } from '@common'

export function getAllPlayers (state) {
  return state.get('players').get('items')
}

export function getPlayers (state) {
  const players = state.get('players')
  const items = players.get('items')
  const positions = players.get('positions')
  const filtered = items.filter(player => positions.includes(player.pos1))
  return filtered.toList()
}

export function getRookiePlayers (state) {
  const players = state.get('players')
  const items = players.get('items')
  return items.filter(p => p.draft_year === constants.year).toList()
}

export function getPlayerById (state, { playerId }) {
  const items = getAllPlayers(state)
  return items.get(playerId)
}

export function getPlayerPositionFilter (state) {
  return state.get('players').get('positions')
}
