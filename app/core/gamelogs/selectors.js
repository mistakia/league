export function getGamelogs (state) {
  return state.get('gamelogs')
}

export function getPlayerGamelogs (state) {
  return state.get('gamelogs').get('players')
}

export function getTeamGamelogs (state) {
  return state.get('gamelogs').get('teams')
}

export function getGamelogByPlayerId (state, { playerId, week }) {
  return getPlayerGamelogs(state).find(g => g.player === playerId && g.week === week)
}
