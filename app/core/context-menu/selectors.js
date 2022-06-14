import { getPlayerById } from '@core/players'

export function getContextMenuInfo(state) {
  return state.get('contextMenu').toJS()
}

export function getContextMenuPlayer(state) {
  const pid = state.getIn(['contextMenu', 'data', 'pid'])
  return getPlayerById(state, { pid })
}
