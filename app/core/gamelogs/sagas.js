import { fork, takeLatest, select, call, takeEvery } from 'redux-saga/effects'

import { appActions, getApp } from '@core/app'
import { getPlayersGamelogs, getRequestHistory } from '@core/api'
import { matchupsActions } from '@core/matchups'

export function* load() {
  const { leagueId, year } = yield select(getApp)

  const request_history = yield select(getRequestHistory)
  const key = `GET_GAMELOGS_${leagueId}_${year}`
  if (!request_history.has(key)) {
    yield call(getPlayersGamelogs, { leagueId, year })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(appActions.INIT_APP, load)
}

export function* watchLoadMatchups() {
  yield takeEvery(matchupsActions.LOAD_MATCHUPS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [fork(watchInitApp), fork(watchLoadMatchups)]
