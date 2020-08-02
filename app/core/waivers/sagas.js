import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { waiverActions } from './actions'
import { postWaiver, postCancelWaiver } from '@core/api'

export function * claim ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postWaiver, { leagueId, teamId, ...payload })
}

export function * cancel ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postCancelWaiver, { leagueId, teamId, ...payload })
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

//= ====================================
//  ROOT
// -------------------------------------

export const waiverSagas = [
  fork(watchClaim),
  fork(watchCancelClaim)
]
