import { call, takeLatest, select, fork } from 'redux-saga/effects'

import { getToken, getApp, appActions } from '@core/app'
import { openWS, closeWS } from './service'

export function * disconnect () {
  yield call(closeWS)
}

export function * connect () {
  const token = yield select(getToken)
  const { leagueId } = yield select(getApp)
  yield call(openWS, { token, leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLogout () {
  yield takeLatest(appActions.LOGOUT, disconnect)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, connect)
}

//= ====================================
//  ROOT
// -------------------------------------

export const wsSagas = [
  fork(watchAuthFulfilled),
  fork(watchLogout)
]
