import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import {
  get_app,
  get_waivers,
  get_waiver_players_for_current_team,
  get_player_maps,
  get_request_history
} from '@core/selectors'
import { waiver_actions } from './actions'
import {
  api_post_waiver,
  api_put_waiver,
  api_post_cancel_waiver,
  api_post_waiver_order,
  api_get_waivers,
  api_get_waiver_report,
  api_get_players
} from '@core/api'
import { notification_actions } from '@core/notifications'

export function* claim({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_waiver, { leagueId, teamId, ...payload })
}

export function* update({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_put_waiver, { leagueId, teamId, ...payload })
}

export function* cancel({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_cancel_waiver, { leagueId, teamId, ...payload })
}

export function* reorder({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  const teamWaivers = yield select(get_waiver_players_for_current_team)
  const { oldIndex, newIndex, type } = payload
  const items = teamWaivers[type]
  const waiver = items.get(oldIndex)
  let newWaiver = items.delete(oldIndex).insert(newIndex, waiver)
  if (type === 'active') {
    newWaiver = newWaiver.sort(
      (a, b) =>
        b.bid - a.bid ||
        newWaiver.findIndex((i) => i.uid === a.uid) -
          newWaiver.findIndex((i) => i.uid === b.uid)
    )
  }
  const waivers = newWaiver.map((w, index) => w.uid).toJS()
  const reset = items.map(({ uid, po }) => ({ uid, po }))
  yield call(api_post_waiver_order, { leagueId, teamId, waivers, reset })
}

export function* waiverNotification() {
  yield put(
    notification_actions.show({
      message: 'Waiver Submitted',
      severity: 'success'
    })
  )
}

export function* waiverOrderNotification() {
  yield put(
    notification_actions.show({
      message: 'Waiver Order Updated',
      severity: 'success'
    })
  )
}

export function* cancelWaiverNotification() {
  yield put(
    notification_actions.show({
      message: 'Waiver Cancelled',
      severity: 'success'
    })
  )
}

export function* updateNotification() {
  yield put(
    notification_actions.show({
      message: 'Waiver Updated',
      severity: 'success'
    })
  )
}

export function* loadWaivers() {
  const { leagueId, teamId } = yield select(get_app)
  const state = yield select(get_waivers)
  const type = state.get('type').get(0)
  const key = `GET_WAIVERS_${leagueId}_${teamId}_${type}`
  const request_history = yield select(get_request_history)
  if (request_history.has(key)) {
    return
  }

  yield call(api_get_waivers, { leagueId, teamId, type })
}

export function* loadWaiverReport() {
  const { leagueId, teamId } = yield select(get_app)
  const state = yield select(get_waivers)
  const type = state.get('type').get(0)
  const processed = state.get('processed').get(0)
  if (!processed) return

  const opts = { leagueId, teamId, type, processed }
  yield call(api_get_waiver_report, opts)
}

export function* filterWaivers({ payload }) {
  if (payload.type === 'processed') {
    yield call(loadWaiverReport)
  } else {
    yield call(loadWaivers)
  }
}

export function* loadPlayers({ payload }) {
  const players = yield select(get_player_maps)
  const missing = payload.data.filter((p) => !players.getIn([p.pid, 'fname']))
  if (missing.length) {
    const { leagueId } = yield select(get_app)
    yield call(api_get_players, { leagueId, pids: missing.map((p) => p.pid) })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchClaim() {
  yield takeLatest(waiver_actions.WAIVER_CLAIM, claim)
}

export function* watchCancelClaim() {
  yield takeLatest(waiver_actions.CANCEL_CLAIM, cancel)
}

export function* watchReorderWaivers() {
  yield takeLatest(waiver_actions.REORDER_WAIVERS, reorder)
}

export function* watchPostWaiverFulfilled() {
  yield takeLatest(waiver_actions.POST_WAIVER_FULFILLED, waiverNotification)
}

export function* watchPostWaiverOrderFulfilled() {
  yield takeLatest(
    waiver_actions.POST_WAIVER_ORDER_FULFILLED,
    waiverOrderNotification
  )
}

export function* watchPostCancelWaiverFulfilled() {
  yield takeLatest(
    waiver_actions.POST_CANCEL_WAIVER_FULFILLED,
    cancelWaiverNotification
  )
}

export function* watch_get_waivers_fulfilled() {
  yield takeLatest(waiver_actions.GET_WAIVERS_FULFILLED, loadWaiverReport)
}

export function* watchLoadWaivers() {
  yield takeLatest(waiver_actions.LOAD_WAIVERS, loadWaivers)
}

export function* watchFilterWaivers() {
  yield takeLatest(waiver_actions.FILTER_WAIVERS, filterWaivers)
}

export function* watchUpdateClaim() {
  yield takeLatest(waiver_actions.UPDATE_WAIVER_CLAIM, update)
}

export function* watchPutWaiverFulfilled() {
  yield takeLatest(waiver_actions.PUT_WAIVER_FULFILLED, updateNotification)
}

export function* watchWaiverReportFulfilled() {
  yield takeLatest(waiver_actions.GET_WAIVER_REPORT_FULFILLED, loadPlayers)
}

//= ====================================
//  ROOT
// -------------------------------------

export const waiver_sagas = [
  fork(watchClaim),
  fork(watchUpdateClaim),
  fork(watchCancelClaim),
  fork(watchReorderWaivers),
  fork(watchPostWaiverOrderFulfilled),
  fork(watchPostWaiverFulfilled),
  fork(watchPostCancelWaiverFulfilled),
  fork(watchPutWaiverFulfilled),

  fork(watch_get_waivers_fulfilled),
  fork(watchFilterWaivers),

  fork(watchLoadWaivers),

  fork(watchWaiverReportFulfilled)
]
