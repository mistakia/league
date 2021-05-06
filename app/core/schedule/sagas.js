import { call, takeLatest, fork } from 'redux-saga/effects'

import { appActions } from '@core/app'
import { getSchedule } from '@core/api'

export function* loadSchedule() {
  yield call(getSchedule)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(appActions.INIT_APP, loadSchedule)
}

//= ====================================
//  ROOT
// -------------------------------------

export const scheduleSagas = [fork(watchInitApp)]
