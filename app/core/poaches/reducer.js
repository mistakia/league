import { Map, Record } from 'immutable'

import { appActions } from '@core/app'
import { poachActions } from './actions'

const Poach = new Record({
  tid: null,
  player: null,
  drop: null,
  submitted: null
})

export function poachesReducer (state = new Map(), { payload, type }) {
  switch (type) {
    case poachActions.POACH_SUBMITTED:
    case poachActions.POST_POACH_FULFILLED:
      return state.withMutations(state => {
        const league = state.get(payload.data.lid) || new Map()
        league.set(payload.data.player, new Poach(payload.data))
        state.set(payload.data.lid, league)
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.poaches.forEach(poach => {
          const league = state.get(poach.lid) || new Map()
          league.set(poach.player, new Poach(poach))
          state.set(poach.lid, league)
        })
      })

    default:
      return state
  }
}
