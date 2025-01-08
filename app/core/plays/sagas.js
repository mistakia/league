import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { playerActions } from '@core/players'
import { getPlays, getPlayStats } from '@core/api'
import { constants } from '@libs-shared'
import { get_request_history } from '@core/selectors'
export function* loadPlays() {
  const request_history = yield select(get_request_history)

  if (request_history.has('GET_PLAYS')) {
    return
  }

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
