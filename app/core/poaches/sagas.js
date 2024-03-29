import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { poachActions } from './actions'
import { postPoach, putPoach, post_process_poach } from '@core/api'
import { notificationActions } from '@core/notifications'

export function* poach({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(postPoach, { leagueId, teamId, ...payload })
}

export function* update({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(putPoach, { leagueId, teamId, ...payload })
}

export function* process_poach({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(post_process_poach, { leagueId, ...payload })
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

export function* poach_process_notification() {
  yield put(
    notificationActions.show({
      message: 'Poach Processed',
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

export function* watchProcessPoach() {
  yield takeLatest(poachActions.PROCESS_POACH, process_poach)
}

export function* watchPostProcessPoachFulfilled() {
  yield takeLatest(
    poachActions.POST_PROCESS_POACH_FULFILLED,
    poach_process_notification
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const poachSagas = [
  fork(watchPoach),
  fork(watchUpdatePoach),
  fork(watchPutPoachFulfilled),
  fork(watchPostPoachFulfilled),
  fork(watchProcessPoach),
  fork(watchPostProcessPoachFulfilled)
]
