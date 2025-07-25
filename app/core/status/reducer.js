import { List, Map } from 'immutable'

import { status_actions } from './actions'

const initialState = new Map({
  is_loading: false,
  jobs: new List()
})

export function status_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case status_actions.GET_STATUS_PENDING:
      return state.set('is_loading', true)

    case status_actions.GET_STATUS_FAILED:
      return state.set('is_loading', false)

    case status_actions.GET_STATUS_FULFILLED:
      return state.set('is_loading', false).set('jobs', new List(payload.data))

    default:
      return state
  }
}
