import { constants } from '@common'

export function getGamelogs(state) {
  return state.get('gamelogs')
}

export function getPlayerGamelogs(state) {
  return state.get('gamelogs').get('players').toList()
}

export function getGamelogByPlayerId(
  state,
  { pid, week, year = constants.year }
) {
  return state.getIn(['gamelogs', 'players', `${year}/REG/${week}/${pid}`])
}
