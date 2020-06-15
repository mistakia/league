import { Map } from 'immutable'

import { appActions } from '@core/app'
import { createSource } from './source'

const initialState = new Map()

export function sourcesReducer (state = initialState, { payload, type }) {
  switch (type) {
    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.sources.forEach(s => state.set(s.uid, createSource(s)))
      })

    case appActions.LOGOUT:
      return initialState

    default:
      return state
  }
}
