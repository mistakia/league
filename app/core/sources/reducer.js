import { Map } from 'immutable'

import { app_actions } from '@core/app'
import { createSource } from './source'
import { source_actions } from './actions'

const initialState = new Map()

export function sources_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case app_actions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.sources.forEach((s) => state.set(s.uid, createSource(s)))
      })

    case source_actions.GET_SOURCES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((s) => state.set(s.uid, createSource(s)))
      })

    case source_actions.SET_SOURCE:
    case source_actions.PUT_SOURCE_FULFILLED:
      return state.setIn(
        [payload.opts.sourceId, 'weight'],
        payload.data ? payload.data.weight : payload.opts.weight
      )

    case app_actions.LOGOUT:
      return initialState

    default:
      return state
  }
}
