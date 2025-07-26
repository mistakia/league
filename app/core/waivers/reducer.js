import { Map, List } from 'immutable'

import { constants } from '@libs-shared'
import { waiver_actions } from './actions'
import { app_actions } from '@core/app'
import { createWaiver } from './waiver'

const initialState = new Map({
  report: new List(),
  type: new List([Object.values(constants.waivers)[0]]),
  processed: new List(),
  processingTimes: new List(),
  teams: new Map(),
  isPending: false
})

export function waivers_reducer(state = initialState, { payload, type }) {
  switch (type) {
    case waiver_actions.POST_WAIVER_FULFILLED:
      return state.withMutations((state) => {
        state.setIn(
          ['teams', payload.data.tid, payload.data.uid],
          createWaiver(payload.data)
        )
      })

    case waiver_actions.PUT_WAIVER_FULFILLED: {
      const uid = Number(payload.data.uid)
      return state.mergeIn(['teams', payload.opts.teamId, uid], {
        bid: payload.data.bid,
        release: new List(payload.data.release)
      })
    }

    case app_actions.AUTH_FULFILLED:
      return state.withMutations((state) => {
        payload.data.waivers.forEach((waiver) => {
          state.setIn(['teams', waiver.tid, waiver.uid], createWaiver(waiver))
        })
      })

    case waiver_actions.POST_WAIVER_ORDER_PENDING:
      return state.withMutations((state) => {
        for (const [index, wid] of payload.opts.waivers.entries()) {
          state.setIn(['teams', payload.opts.teamId, wid, 'po'], index)
        }
      })

    case waiver_actions.POST_WAIVER_ORDER_FAILED:
      return state.withMutations((state) => {
        for (const w of payload.opts.reset) {
          state.setIn(['teams', payload.opts.teamId, w.uid, 'po'], w.po)
        }
      })

    case waiver_actions.POST_CANCEL_WAIVER_FULFILLED:
      return state.deleteIn(['teams', payload.data.tid, payload.data.uid])

    case waiver_actions.GET_WAIVERS_FULFILLED:
      return state.merge({
        isPending: false,
        processed: payload.data.length
          ? new List([payload.data[0].processed])
          : new List(),
        processingTimes: new List(payload.data.map((p) => p.processed))
      })

    case waiver_actions.GET_WAIVERS_PENDING:
    case waiver_actions.GET_WAIVER_REPORT_PENDING:
      return state.merge({
        isPending: true
      })

    case waiver_actions.GET_WAIVERS_FAILED:
    case waiver_actions.GET_WAIVER_REPORT_FAILED:
      return state.merge({
        isPending: false
      })

    case waiver_actions.GET_WAIVER_REPORT_FULFILLED:
      return state.merge({
        report: new List(payload.data.map((p) => createWaiver(p))),
        isPending: false
      })

    case waiver_actions.FILTER_WAIVERS:
      return state.merge({
        isPending: true,
        report: new List(),
        [payload.type]: new List(payload.values)
      })

    default:
      return state
  }
}
