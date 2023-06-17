import { fork, takeLatest, call } from 'redux-saga/effects'

import { playerActions } from '@core/players'
import { getPlays, getPlayStats } from '@core/api'
import { constants } from '@libs-shared'

export function* loadPlays() {
  yield call(getPlays)
  yield call(getPlayStats)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchFetchPlayersFulfilled() {
  if (constants.isRegularSeason) {
    yield takeLatest(
      [
        playerActions.FETCH_ALL_PLAYERS_FULFILLED,
        playerActions.FETCH_LEAGUE_PLAYERS_FULFILLED,
        playerActions.FETCH_TEAM_PLAYERS_FULFILLED
      ],
      loadPlays
    )
  }
}

//= ====================================
//  ROOT
// -------------------------------------

export const playSagas = [fork(watchFetchPlayersFulfilled)]
