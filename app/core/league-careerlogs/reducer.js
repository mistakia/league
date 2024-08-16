import { Map } from 'immutable'

import { league_careerlogs_actions } from './actions'

export function league_careerlogs_reducer(
  state = new Map(),
  { payload, type }
) {
  switch (type) {
    case league_careerlogs_actions.GET_LEAGUE_CAREERLOGS_FULFILLED:
      return state.withMutations((map) => {
        map.set(payload.opts.leagueId, new Map(payload.data))
      })
    default:
      return state
  }
}
