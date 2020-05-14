import { fork, takeLatest, call } from 'redux-saga/effects'

import { fetchPlayers } from '@core/api'
import { playerActions } from './actions'

export function * loadPlayers () {
  yield call(fetchPlayers)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadPlayers () {
  yield takeLatest(playerActions.LOAD_PLAYERS, loadPlayers)
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchLoadPlayers)
]
