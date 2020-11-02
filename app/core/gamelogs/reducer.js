import { List } from 'immutable'

import { gamelogsActions } from './actions'

export function gamelogsReducer (state = new List(), { payload, type }) {
  switch (type) {
    case gamelogsActions.GET_GAMELOGS_FULFILLED:
      return new List(payload.data)

    default:
      return state
  }
}
