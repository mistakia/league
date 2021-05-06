import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { leagueActions } from './actions'
import { putLeague } from '@core/api'
import { getApp } from '@core/app'
import { notificationActions } from '@core/notifications'

export function* updateLeague({ payload }) {
  const { token } = yield select(getApp)
  if (token) yield call(putLeague, payload)
  else yield put(leagueActions.set(payload))
}

export function* saveNotification() {
  yield put(
    notificationActions.show({
      message: 'League setting saved',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateLeague() {
  yield takeLatest(leagueActions.UPDATE_LEAGUE, updateLeague)
}

export function* watchPutLeagueFulfilled() {
  yield takeLatest(leagueActions.PUT_LEAGUE_FULFILLED, saveNotification)
}

//= ====================================
//  ROOT
// -------------------------------------

export const leagueSagas = [
  fork(watchUpdateLeague),
  fork(watchPutLeagueFulfilled)
]
