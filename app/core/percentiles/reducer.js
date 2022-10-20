import { Map } from 'immutable'

import { percentileActions } from './actions'
import { playerActions } from '@core/players'

export function percentilesReducer(state = new Map(), { payload, type }) {
  switch (type) {
    case percentileActions.GET_PERCENTILES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach(({ field, percentile_key, ...percentile }) => {
          state.setIn([percentile_key, field], percentile)
        })
      })

    case playerActions.SET_PLAYER_STATS:
      return state.withMutations((state) => {
        for (const stat in payload.percentiles) {
          state.setIn(
            ['PLAYER_PLAY_BY_PLAY_STATS', stat],
            payload.percentiles[stat]
          )
        }
      })

    default:
      return state
  }
}
