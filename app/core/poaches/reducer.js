import { Map, Record, List } from 'immutable'

import { appActions } from '@core/app'
import { poachActions } from './actions'

const Poach = new Record({
  tid: null,
  player: null,
  processed: null,
  release: new List(),
  submitted: null
})

const createPoach = ({ tid, player, processed, release, submitted }) =>
  new Poach({
    tid,
    player,
    processed,
    release: new List(release),
    submitted
  })

export function poachesReducer(state = new Map(), { payload, type }) {
  switch (type) {
    case poachActions.POACH_SUBMITTED:
    case poachActions.POST_POACH_FULFILLED:
      return state.withMutations((state) => {
        let leaguePoaches = state.get(payload.data.lid) || new Map()
        leaguePoaches = leaguePoaches.set(
          payload.data.player,
          createPoach(payload.data)
        )
        state.set(payload.data.lid, leaguePoaches)
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.poaches.forEach((poach) => {
          let leaguePoaches = state.get(poach.lid) || new Map()
          leaguePoaches = leaguePoaches.set(poach.player, createPoach(poach))
          state.set(poach.lid, leaguePoaches)
        })
      })

    default:
      return state
  }
}
