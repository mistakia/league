import { fork, takeLatest, select } from 'redux-saga/effects'

import { appActions, getApp } from '@core/app'
import { getPlayersGamelogs } from '@core/api'

export function* load() {
  const { leagueId } = yield select(getApp)
  yield fork(getPlayersGamelogs, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(appActions.INIT_APP, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [fork(watchInitApp)]
