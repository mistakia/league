export function getGamelogs (state) {
  return state.get('gamelogs')
}

export function getGamelogByPlayerId (state, { playerId, week }) {
  return getGamelogs(state).find(g => g.player === playerId && g.week === week)
}
