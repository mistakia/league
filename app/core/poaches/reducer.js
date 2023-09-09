import { Map } from 'immutable'

import { appActions } from '@core/app'
import { poachActions } from './actions'
import { createPoach } from './poach'

export function poachesReducer(state = new Map(), { payload, type }) {
  switch (type) {
    case poachActions.POACH_SUBMITTED:
    case poachActions.POST_POACH_FULFILLED:
    case poachActions.PUT_POACH_FULFILLED:
    case poachActions.POST_PROCESS_POACH_FULFILLED:
      return state.withMutations((state) => {
        let leaguePoaches = state.get(payload.data.lid) || new Map()
        leaguePoaches = leaguePoaches.set(
          payload.data.pid,
          createPoach(payload.data)
        )
        state.set(payload.data.lid, leaguePoaches)
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.poaches.forEach((poach) => {
          let leaguePoaches = state.get(poach.lid) || new Map()
          leaguePoaches = leaguePoaches.set(poach.pid, createPoach(poach))
          state.set(poach.lid, leaguePoaches)
        })
      })

    default:
      return state
  }
}
