import { fork, takeLatest } from 'redux-saga/effects'

import { appActions } from '@core/app'
import { getPlayerGamelogs } from '@core/api'

export function * loadPlayerGamelogs () {
  yield fork(getPlayerGamelogs)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchInitApp () {
  yield takeLatest(appActions.INIT_APP, loadPlayerGamelogs)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [
  fork(watchInitApp)
]
