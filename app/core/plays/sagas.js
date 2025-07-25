import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { player_actions } from '@core/players'
import { api_get_plays, api_get_play_stats } from '@core/api'
import { constants } from '@libs-shared'
import { get_request_history } from '@core/selectors'
export function* loadPlays() {
  const request_history = yield select(get_request_history)

  if (request_history.has('GET_PLAYS')) {
    return
  }

  yield call(api_get_plays)
  yield call(api_get_play_stats)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_fetch_players_fulfilled() {
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

export const play_sagas = [fork(watch_fetch_players_fulfilled)]
