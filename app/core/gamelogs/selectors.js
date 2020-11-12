export function getPlayerGamelogs (state) {
  return state.get('gamelogs').get('players')
}

export function getGamelogByPlayerId (state, { playerId, week }) {
  return getPlayerGamelogs(state).find(g => g.player === playerId && g.week === week)
}
