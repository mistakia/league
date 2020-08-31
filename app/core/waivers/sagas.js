import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { waiverActions } from './actions'
import { postWaiver, postCancelWaiver, postWaiverOrder } from '@core/api'
import { getWaiverPlayersForCurrentTeam } from './selectors'
import { notificationActions } from '@core/notifications'

export function * claim ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postWaiver, { leagueId, teamId, ...payload })
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

//= ====================================
//  ROOT
// -------------------------------------

export const waiverSagas = [
  fork(watchClaim),
  fork(watchCancelClaim),
  fork(watchReorderWaivers),
  fork(watchPostWaiverOrderFulfilled),
  fork(watchPostWaiverFulfilled),
  fork(watchPostCancelWaiverFulfilled)
]
