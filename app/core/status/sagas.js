import { call, takeLatest, fork } from 'redux-saga/effects'

import { statusActions } from './actions'
import { getStatus } from '@core/api'

export function* loadStatus() {
  yield call(getStatus)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadStatus() {
  yield takeLatest(statusActions.LOAD_STATUS, loadStatus)
}

//= ====================================
//  ROOT
// -------------------------------------

export const statusSagas = [fork(watchLoadStatus)]
