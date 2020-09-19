import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { waiverActions } from './actions'
import {
  postWaiver,
  putWaiver,
  postCancelWaiver,
  postWaiverOrder,
  fetchWaivers,
  getWaiverReport
} from '@core/api'
import { getWaivers, getWaiverPlayersForCurrentTeam } from './selectors'
import { notificationActions } from '@core/notifications'

export function * claim ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postWaiver, { leagueId, teamId, ...payload })
}

export function * update ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(putWaiver, { leagueId, teamId, ...payload })
}

export function * cancel ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postCancelWaiver, { leagueId, teamId, ...payload })
}

export function * reorder ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  const teamWaivers = yield select(getWaiverPlayersForCurrentTeam)
  const { oldIndex, newIndex, type } = payload
  const items = teamWaivers[type]
  const waiver = items.get(oldIndex)
  let newWaiver = items.delete(oldIndex).insert(newIndex, waiver)
  if (type === 'active') {
    newWaiver = newWaiver.sort((a, b) => b.bid - a.bid ||
      newWaiver.findIndex(i => i.uid === a.uid) - newWaiver.findIndex(i => i.uid === b.uid))
  }
  const waivers = newWaiver.map((w, index) => w.uid).toJS()
  const reset = items.map(({ uid, po }) => ({ uid, po }))
  yield call(postWaiverOrder, { leagueId, teamId, waivers, reset })
}

export function * waiverNotification () {
  yield put(notificationActions.show({
    message: 'Waiver Submitted',
    severity: 'success'
  }))
}

export function * waiverOrderNotification () {
  yield put(notificationActions.show({
    message: 'Waiver Order Updated',
    severity: 'success'
  }))
}

export function * cancelWaiverNotification () {
  yield put(notificationActions.show({
    message: 'Waiver Cancelled',
    severity: 'success'
  }))
}

export function * updateNotification () {
  yield put(notificationActions.show({
    message: 'Waiver Updated',
    severity: 'success'
  }))
}

export function * loadWaivers () {
  const { leagueId, teamId } = yield select(getApp)
  const state = yield select(getWaivers)
  const type = state.get('type').get(0)
  yield call(fetchWaivers, { leagueId, teamId, type })
}

export function * loadWaiverReport () {
  const { leagueId, teamId } = yield select(getApp)
  const state = yield select(getWaivers)
  const type = state.get('type').get(0)
  const processed = state.get('processed').get(0)
  if (!processed) return
  yield call(getWaiverReport, { leagueId, teamId, type, processed })
}

export function * filterWaivers ({ payload }) {
  if (payload.type === 'processed') {
    yield call(loadWaiverReport)
  } else {
    yield call(loadWaivers)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchClaim () {
  yield takeLatest(waiverActions.WAIVER_CLAIM, claim)
}

export function * watchCancelClaim () {
  yield takeLatest(waiverActions.CANCEL_CLAIM, cancel)
}

export function * watchReorderWaivers () {
  yield takeLatest(waiverActions.REORDER_WAIVERS, reorder)
}

export function * watchPostWaiverFulfilled () {
  yield takeLatest(waiverActions.POST_WAIVER_FULFILLED, waiverNotification)
}

export function * watchPostWaiverOrderFulfilled () {
  yield takeLatest(waiverActions.POST_WAIVER_ORDER_FULFILLED, waiverOrderNotification)
}

export function * watchPostCancelWaiverFulfilled () {
  yield takeLatest(waiverActions.POST_CANCEL_WAIVER_FULFILLED, cancelWaiverNotification)
}

export function * watchGetWaiversFulfilled () {
  yield takeLatest(waiverActions.GET_WAIVERS_FULFILLED, loadWaiverReport)
}

export function * watchLoadWaivers () {
  yield takeLatest(waiverActions.LOAD_WAIVERS, loadWaivers)
}

export function * watchFilterWaivers () {
  yield takeLatest(waiverActions.FILTER_WAIVERS, filterWaivers)
}

export function * watchUpdateClaim () {
  yield takeLatest(waiverActions.UPDATE_WAIVER_CLAIM, update)
}

export function * watchPutWaiverFulfilled () {
  yield takeLatest(waiverActions.PUT_WAIVER_FULFILLED, updateNotification)
}

//= ====================================
//  ROOT
// -------------------------------------

export const waiverSagas = [
  fork(watchClaim),
  fork(watchUpdateClaim),
  fork(watchCancelClaim),
  fork(watchReorderWaivers),
  fork(watchPostWaiverOrderFulfilled),
  fork(watchPostWaiverFulfilled),
  fork(watchPostCancelWaiverFulfilled),
  fork(watchPutWaiverFulfilled),

  fork(watchGetWaiversFulfilled),
  fork(watchFilterWaivers),

  fork(watchLoadWaivers)
]
