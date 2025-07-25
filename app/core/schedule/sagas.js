import { call, takeLatest, fork } from 'redux-saga/effects'

import { app_actions } from '@core/app'
import { api_get_schedule } from '@core/api'

export function* loadSchedule() {
  yield call(api_get_schedule)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(app_actions.INIT_APP, loadSchedule)
}

//= ====================================
//  ROOT
// -------------------------------------

export const schedule_sagas = [fork(watchInitApp)]
