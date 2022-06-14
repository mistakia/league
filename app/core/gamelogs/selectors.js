export function getGamelogs(state) {
  return state.get('gamelogs')
}

export function getPlayerGamelogs(state) {
  return state.get('gamelogs').get('players')
}

export function getTeamGamelogs(state) {
  return state.get('gamelogs').get('teams')
}

export function getGamelogByPlayerId(state, { pid, week }) {
  return getPlayerGamelogs(state).find((g) => g.pid === pid && g.week === week)
}
