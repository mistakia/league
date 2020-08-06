import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { waiverActions } from './actions'
import { postWaiver, postCancelWaiver, postWaiverOrder } from '@core/api'
import { getWaiverPlayersForCurrentTeam } from './selectors'

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
  const { poach } = yield select(getWaiverPlayersForCurrentTeam)
  const { oldIndex, newIndex } = payload
  const waiver = poach.get(oldIndex)
  const newPoach = poach.delete(oldIndex).insert(newIndex, waiver)
  const waivers = newPoach.map((w, index) => w.uid).toJS()
  const reset = poach.map(({ uid, po }) => ({ uid, po }))
  yield call(postWaiverOrder, { leagueId, teamId, waivers, reset })
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

export function * watchReorderPoach () {
  yield takeLatest(waiverActions.REORDER_POACH, reorder)
}

//= ====================================
//  ROOT
// -------------------------------------

export const waiverSagas = [
  fork(watchClaim),
  fork(watchCancelClaim),
  fork(watchReorderPoach)
]
