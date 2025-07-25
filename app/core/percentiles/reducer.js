import { Map } from 'immutable'

import { percentile_actions } from './actions'
import { player_actions } from '@core/players'

export function percentiles_reducer(state = new Map(), { payload, type }) {
  switch (type) {
    case percentile_actions.GET_PERCENTILES_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach(({ field, percentile_key, ...percentile }) => {
          state.setIn([percentile_key, field], percentile)
        })
      })

    case player_actions.SET_PLAYER_STATS:
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
