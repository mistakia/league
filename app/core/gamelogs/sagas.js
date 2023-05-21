import { fork, takeLatest, select, call, takeEvery } from 'redux-saga/effects'

import { appActions } from '@core/app'
import { getPlayersGamelogs } from '@core/api'
import { get_app, get_request_history } from '@core/selectors'
import { matchupsActions } from '@core/matchups'

export function* load() {
  const { leagueId, year } = yield select(get_app)

  const request_history = yield select(get_request_history)
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
