import { call, takeLatest, fork } from 'redux-saga/effects'

import { status_actions } from './actions'
import { api_get_status } from '@core/api'

export function* load_status() {
  yield call(api_get_status)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_status() {
  yield takeLatest(status_actions.LOAD_STATUS, load_status)
}

//= ====================================
//  ROOT
// -------------------------------------

export const status_sagas = [fork(watch_load_status)]
