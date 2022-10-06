import { fork, takeLatest, select, call, put } from 'redux-saga/effects'

import { appActions, getApp } from '@core/app'
import { getPlayersGamelogs } from '@core/api'
import { getPlayerGamelogs } from './selectors'
import { gamelogsActions } from './actions'
import Worker from 'workerize-loader?inline!../worker' // eslint-disable-line import/no-webpack-loader-syntax

export function* load() {
  const { leagueId } = yield select(getApp)
  yield fork(getPlayersGamelogs, { leagueId })
}

export function* processPlayerGamelogs() {
  const gamelogs = yield select(getPlayerGamelogs)
  const worker = new Worker()
  const result = yield call(worker.processPlayerGamelogs, gamelogs.toJS())
  yield put(gamelogsActions.setPlayerGamelogsAnalysis(result))
  worker.terminate()
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchGetPlayersGamelogsFulfilled() {
  yield takeLatest(
    gamelogsActions.GET_PLAYERS_GAMELOGS_FULFILLED,
    processPlayerGamelogs
  )
}

export function* watchInitApp() {
  yield takeLatest(appActions.INIT_APP, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [
  fork(watchInitApp),
  fork(watchGetPlayersGamelogsFulfilled)
]
