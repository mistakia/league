import { fork, takeLatest, call, select, put } from 'redux-saga/effects'

import { fetchPlayers } from '@core/api'
import { playerActions } from './actions'
import { appActions } from '@core/app'
import { getAllPlayers } from './selectors'
import { getLeagues } from '@core/leagues'

export function * loadPlayers () {
  yield call(fetchPlayers)
}

export function * calculateValues () {
  const leagues = yield select(getLeagues)
  const players = yield select(getAllPlayers)

  yield put(playerActions.calculate({ players, leagues }))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadPlayers () {
  yield takeLatest(playerActions.LOAD_PLAYERS, loadPlayers)
}

export function * watchFetchPlayersFulfilled () {
  yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, calculateValues)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadPlayers)
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchLoadPlayers),
  fork(watchFetchPlayersFulfilled),
  fork(watchAuthFulfilled)
]
