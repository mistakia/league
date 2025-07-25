import { Record, Map } from 'immutable'

import { schedule_actions } from './actions'

const initialState = new Record({
  teams: new Map()
})

export function schedule_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case schedule_actions.GET_SCHEDULE_FULFILLED:
      return state.merge({
        teams: payload.data
      })

    default:
      return state
  }
}
