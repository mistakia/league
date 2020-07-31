import { Map, Record } from 'immutable'

import { waiverActions } from './actions'
import { appActions } from '@core/app'

const Waiver = new Record({
  tid: null,
  player: null,
  drop: null,
  bid: null,
  type: null
})

export function waiversReducer (state = new Map(), { payload, type }) {
  switch (type) {
    case waiverActions.POST_WAIVER_FULFILLED:
      return state.withMutations(state => {
        const team = state.get(payload.data.tid) || new Map()
        team.set(payload.data.player, new Waiver(payload.data))
        state.set(payload.data.tid, team)
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.waivers.forEach(waiver => {
          const team = state.get(waiver.tid) || new Map()
          team.set(waiver.player, new Waiver(waiver))
          state.set(waiver.tid, team)
        })
      })

    default:
      return state
  }
}
