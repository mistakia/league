import { getPlayerById } from '@core/players'

export function getContextMenuInfo (state) {
  return state.get('contextMenu').toJS()
}

export function getContextMenuPlayer (state) {
  const playerId = state.getIn(['contextMenu', 'data', 'playerId'])
  return getPlayerById(state, { playerId })
}
