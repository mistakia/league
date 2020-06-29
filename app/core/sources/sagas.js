import { call, takeLatest, fork } from 'redux-saga/effects'

import { sourceActions } from './actions'
import { putSource } from '@core/api'

export function * updateSource ({ payload }) {
  yield call(putSource, payload)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchUpdateSource () {
  yield takeLatest(sourceActions.UPDATE_SOURCE, updateSource)
}

//= ====================================
//  ROOT
// -------------------------------------

export const sourceSagas = [
  fork(watchUpdateSource)
]
