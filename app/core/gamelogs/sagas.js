import { fork, takeLatest, select, call, put } from 'redux-saga/effects'

import { appActions } from '@core/app'
import { fetchPlayerGamelogs, fetchTeamGamelogs } from '@core/api'
import { getPlayerGamelogs, getTeamGamelogs } from './selectors'
import { gamelogsActions } from './actions'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * load () {
  yield fork(fetchPlayerGamelogs)
  yield fork(fetchTeamGamelogs)
}

export function * processPlayerGamelogs () {
  const gamelogs = yield select(getPlayerGamelogs)
  const worker = new Worker()
  const result = yield call(worker.processPlayerGamelogs, gamelogs.toJS())
  yield put(gamelogsActions.setPlayerGamelogsAnalysis(result))
  worker.terminate()
}

export function * processTeamGamelogs () {
  const gamelogs = yield select(getTeamGamelogs)
  const worker = new Worker()
  const result = yield call(worker.processTeamGamelogs, gamelogs.toJS())
  yield put(gamelogsActions.setTeamGamelogsAnalysis(result))
  worker.terminate()
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchGetPlayerGamelogsFulfilled () {
  yield takeLatest(gamelogsActions.GET_PLAYER_GAMELOGS_FULFILLED, processPlayerGamelogs)
}

export function * watchGetTeamGamelogsFulfilled () {
  yield takeLatest(gamelogsActions.GET_TEAM_GAMELOGS_FULFILLED, processTeamGamelogs)
}

export function * watchInitApp () {
  yield takeLatest(appActions.INIT_APP, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [
  fork(watchInitApp),
  fork(watchGetTeamGamelogsFulfilled),
  fork(watchGetPlayerGamelogsFulfilled)
]
