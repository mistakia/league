import { List } from 'immutable'

import { draft_pick_value_actions } from './actions'

export function draft_pick_value_reducer(
  state = new List(),
  { payload, type }
) {
  switch (type) {
    case draft_pick_value_actions.GET_DRAFT_PICK_VALUE_FULFILLED:
      return new List(payload.data)

    default:
      return state
  }
}
