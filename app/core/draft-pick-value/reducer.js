import { List } from 'immutable'

import { draftPickValueActions } from './actions'

export function draftPickValueReducer(state = new List(), { payload, type }) {
  switch (type) {
    case draftPickValueActions.GET_DRAFT_PICK_VALUE_FULFILLED:
      return new List(payload.data)

    default:
      return state
  }
}
