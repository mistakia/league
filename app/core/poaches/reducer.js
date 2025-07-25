import { Map } from 'immutable'

import { app_actions } from '@core/app'
import { poach_actions } from './actions'
import { createPoach } from './poach'

export function poaches_reducer(state = new Map(), { payload, type }) {
  switch (type) {
    case poach_actions.POACH_SUBMITTED:
    case poach_actions.POST_POACH_FULFILLED:
    case poach_actions.PUT_POACH_FULFILLED:
    case poach_actions.POST_PROCESS_POACH_FULFILLED:
      return state.withMutations((state) => {
        let leaguePoaches = state.get(payload.data.lid) || new Map()
        leaguePoaches = leaguePoaches.set(
          payload.data.pid,
          createPoach(payload.data)
        )
        state.set(payload.data.lid, leaguePoaches)
      })

    case app_actions.AUTH_FULFILLED:
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
