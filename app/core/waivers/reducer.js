import { Map, Record } from 'immutable'

import { waiverActions } from './actions'
import { appActions } from '@core/app'

const Waiver = new Record({
  uid: null,
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
        let team = state.get(payload.data.tid) || new Map()
        team = team.set(payload.data.uid, new Waiver(payload.data))
        state.set(payload.data.tid, team)
      })

    case appActions.AUTH_FULFILLED:
      return state.withMutations(state => {
        payload.data.waivers.forEach(waiver => {
          let team = state.get(waiver.tid) || new Map()
          team = team.set(waiver.uid, new Waiver(waiver))
          state.set(waiver.tid, team)
        })
      })

    case waiverActions.POST_CANCEL_WAIVER_FULFILLED: {
      return state.deleteIn([payload.data.tid, payload.data.uid])
    }

    default:
      return state
  }
}
