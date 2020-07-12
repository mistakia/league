import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { appActions, getApp } from '@core/app'
import { sourceActions } from './actions'
import { putSource, getSources } from '@core/api'

export function * init () {
  const { token } = yield select(getApp)
  if (!token) {
    yield call(getSources)
  }
}

export function * updateSource ({ payload }) {
  const { token } = yield select(getApp)
  if (token) yield call(putSource, payload)
  else yield put(sourceActions.set(payload))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchUpdateSource () {
  yield takeLatest(sourceActions.UPDATE_SOURCE, updateSource)
}

export function * watchInitApp () {
  yield takeLatest(appActions.INIT_APP, init)
}

//= ====================================
//  ROOT
// -------------------------------------

export const sourceSagas = [
  fork(watchUpdateSource),
  fork(watchInitApp)
]
