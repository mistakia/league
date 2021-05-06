import { List } from 'immutable'

import { statusActions } from './actions'

export function statusReducer(state = new List(), { payload, type }) {
  switch (type) {
    case statusActions.GET_STATUS_FULFILLED:
      return new List(payload.data)

    default:
      return state
  }
}
