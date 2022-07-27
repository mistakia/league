import { fork, takeLatest, call } from 'redux-saga/effects'

import { playerActions } from '@core/players'
import { getPlays, getPlayStats } from '@core/api'
import { constants } from '@common'

export function* loadPlays() {
  yield call(getPlays)
  yield call(getPlayStats)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchFetchPlayersFulfilled() {
  if (constants.isRegularSeason) {
    yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, loadPlays)
  }
}

//= ====================================
//  ROOT
// -------------------------------------

export const playSagas = [fork(watchFetchPlayersFulfilled)]
