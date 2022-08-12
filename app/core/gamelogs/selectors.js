import { constants } from '@common'

export function getGamelogs(state) {
  return state.get('gamelogs')
}

export function getPlayerGamelogs(state) {
  return state.get('gamelogs').get('players').toList()
}

export function getCurrentYearPlayerGamelogs(state) {
  const gamelogs = getPlayerGamelogs(state)
  return gamelogs.filter((g) => g.year === constants.year)
}

export function getTeamGamelogs(state) {
  return state.get('gamelogs').get('teams')
}

export function getGamelogByPlayerId(
  state,
  { pid, week, year = constants.year }
) {
  return state.getIn(['gamelogs', 'players', `${year}/REG/${week}/${pid}`])
}
