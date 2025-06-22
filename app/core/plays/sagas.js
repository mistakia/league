import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { player_actions } from '@core/players'
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
        player_actions.FETCH_ALL_PLAYERS_FULFILLED,
        player_actions.FETCH_LEAGUE_PLAYERS_FULFILLED,
        player_actions.FETCH_TEAM_PLAYERS_FULFILLED
      ],
      loadPlays
    )
  }
}

//= ====================================
//  ROOT
// -------------------------------------

export const playSagas = [fork(watchFetchPlayersFulfilled)]
