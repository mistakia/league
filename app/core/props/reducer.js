import { List, Map } from 'immutable'

import { propActions } from './actions'
import { constants } from '@libs-shared'

const initialState = new Map({
  types: new List(Object.values(constants.player_prop_types)),
  items: new List()
})

export function propsReducer(state = initialState, { payload, type }) {
  switch (type) {
    case propActions.GET_PROPS_FULFILLED:
      return state.set('items', new List(payload.data))

    default:
      return state
  }
}
