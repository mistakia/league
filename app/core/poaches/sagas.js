import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { poachActions } from './actions'
import { postPoach, putPoach } from '@core/api'
import { notificationActions } from '@core/notifications'

export function* poach({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(postPoach, { leagueId, teamId, ...payload })
}

export function* update({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(putPoach, { leagueId, teamId, ...payload })
}

export function* poachNotification() {
  yield put(
    notificationActions.show({
      message: 'Poach Submitted',
      severity: 'success'
    })
  )
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

export function* watchPostPoachFulfilled() {
  yield takeLatest(poachActions.POST_POACH_FULFILLED, poachNotification)
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
  fork(watchPutPoachFulfilled),
  fork(watchPostPoachFulfilled)
]
