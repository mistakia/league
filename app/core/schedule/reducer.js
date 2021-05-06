import { Record, Map } from 'immutable'

import { scheduleActions } from './actions'

const initialState = new Record({
  teams: new Map()
})

export function scheduleReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case scheduleActions.GET_SCHEDULE_FULFILLED:
      return state.merge({
        teams: payload.data
      })

    default:
      return state
  }
}
