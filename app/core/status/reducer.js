import { List, Map } from 'immutable'

import { statusActions } from './actions'

const initialState = new Map({
  is_loading: false,
  jobs: new List()
})

export function statusReducer(state = initialState, { payload, type }) {
  switch (type) {
    case statusActions.GET_STATUS_PENDING:
      return state.set('is_loading', true)

    case statusActions.GET_STATUS_FAILED:
      return state.set('is_loading', false)

    case statusActions.GET_STATUS_FULFILLED:
      return state.set('is_loading', false).set('jobs', new List(payload.data))

    default:
      return state
  }
}
