import { Map } from 'immutable'

import { percentileActions } from './actions'

export function percentilesReducer(state = new Map(), { payload, type }) {
  switch (type) {
    case percentileActions.GET_PERCENTILES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach(({ field, percentile_key, ...percentile }) => {
          state.setIn([percentile_key, field], percentile)
        })
      })
    default:
      return state
  }
}
