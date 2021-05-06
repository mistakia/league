import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createSource } from './source'
import { sourceActions } from './actions'

const initialState = new Map()

export function sourcesReducer(state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.sources.forEach((s) => state.set(s.uid, createSource(s)))
      })

    case sourceActions.GET_SOURCES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((s) => state.set(s.uid, createSource(s)))
      })

    case sourceActions.SET_SOURCE:
    case sourceActions.PUT_SOURCE_FULFILLED:
      return state.setIn(
        [payload.opts.sourceId, 'weight'],
        payload.data ? payload.data.weight : payload.opts.weight
      )

    case appActions.LOGOUT:
      return initialState

    default:
      return state
  }
}
