import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { poach_actions } from './actions'
import {
  api_post_poach,
  api_put_poach,
  api_post_process_poach
} from '@core/api'
import { notification_actions } from '@core/notifications'

export function* poach({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_poach, { leagueId, teamId, ...payload })
}

export function* update({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_put_poach, { leagueId, teamId, ...payload })
}

export function* process_poach({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(api_post_process_poach, { leagueId, ...payload })
}

export function* poachNotification() {
  yield put(
    notification_actions.show({
      message: 'Poach Submitted',
      severity: 'success'
    })
  )
}

export function* updateNotification() {
  yield put(
    notification_actions.show({
      message: 'Poach Updated',
      severity: 'success'
    })
  )
}

export function* poach_process_notification() {
  yield put(
    notification_actions.show({
      message: 'Poach Processed',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPoach() {
  yield takeLatest(poach_actions.POACH_PLAYER, poach)
}

export function* watchUpdatePoach() {
  yield takeLatest(poach_actions.UPDATE_POACH, update)
}

export function* watchPostPoachFulfilled() {
  yield takeLatest(poach_actions.POST_POACH_FULFILLED, poachNotification)
}

export function* watchPutPoachFulfilled() {
  yield takeLatest(poach_actions.PUT_POACH_FULFILLED, updateNotification)
}

export function* watchProcessPoach() {
  yield takeLatest(poach_actions.PROCESS_POACH, process_poach)
}

export function* watchPostProcessPoachFulfilled() {
  yield takeLatest(
    poach_actions.POST_PROCESS_POACH_FULFILLED,
    poach_process_notification
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const poach_sagas = [
  fork(watchPoach),
  fork(watchUpdatePoach),
  fork(watchPutPoachFulfilled),
  fork(watchPostPoachFulfilled),
  fork(watchProcessPoach),
  fork(watchPostProcessPoachFulfilled)
]
