import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { poachActions } from './actions'
import { postPoach, putPoach } from '@core/api'
import { notificationActions } from '@core/notifications'

export function* poach({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postPoach, { leagueId, teamId, ...payload })
}

export function* update({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(putPoach, { leagueId, teamId, ...payload })
}

export function* updateNotification() {
  yield put(
    notificationActions.show({
      message: 'Poach Updated',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPoach() {
  yield takeLatest(poachActions.POACH_PLAYER, poach)
}

export function* watchUpdatePoach() {
  yield takeLatest(poachActions.UPDATE_POACH, update)
}

export function* watchPutPoachFulfilled() {
  yield takeLatest(poachActions.PUT_POACH_FULFILLED, updateNotification)
}

//= ====================================
//  ROOT
// -------------------------------------

export const poachSagas = [
  fork(watchPoach),
  fork(watchUpdatePoach),
  fork(watchPutPoachFulfilled)
]
