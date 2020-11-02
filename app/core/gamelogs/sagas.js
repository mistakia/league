import { fork, takeLatest } from 'redux-saga/effects'

import { playerActions } from '@core/players'
import { getGamelogs } from '@core/api'

export function * loadGamelogs () {
  yield fork(getGamelogs)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchFetchPlayersFulfilled () {
  yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, loadGamelogs)
}

//= ====================================
//  ROOT
// -------------------------------------

export const gamelogSagas = [
  fork(watchFetchPlayersFulfilled)
]
