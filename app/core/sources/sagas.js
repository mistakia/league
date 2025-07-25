import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'
import { source_actions } from './actions'
import { api_put_source, api_get_sources } from '@core/api'

export function* init() {
  const { token } = yield select(get_app)
  if (!token) {
    yield call(api_get_sources)
  }
}

export function* updateSource({ payload }) {
  const { token } = yield select(get_app)
  if (token) yield call(api_put_source, payload)
  else yield put(source_actions.set(payload))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateSource() {
  yield takeLatest(source_actions.UPDATE_SOURCE, updateSource)
}

export function* watchInitApp() {
  yield takeLatest(app_actions.INIT_APP, init)
}

//= ====================================
//  ROOT
// -------------------------------------

export const source_sagas = [fork(watchUpdateSource), fork(watchInitApp)]
