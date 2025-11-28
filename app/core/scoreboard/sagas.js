import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { get_scoreboard, getScoreboardUpdated } from '@core/selectors'
import { scoreboard_actions } from './actions'
import { play_actions } from '@core/plays'
import { send, wsActions } from '@core/ws'
import { current_season } from '@constants'

export function* register() {
  if (!current_season.isRegularSeason) return
  const updated = yield select(getScoreboardUpdated)
  console.log(`register scoreboard ${updated}`)
  send({
    type: scoreboard_actions.SCOREBOARD_REGISTER,
    payload: { updated }
  })
}

export function* reregister() {
  const state = yield select(get_scoreboard)
  const isLoaded = state.get('isLoaded')
  if (isLoaded) {
    yield call(register)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchGetScoreboardFulfilled() {
  yield takeLatest(play_actions.GET_PLAYSTATS_FULFILLED, register)
}

export function* watchUpdateScoreboardPlays() {
  yield takeLatest(scoreboard_actions.UPDATE_SCOREBOARD_PLAYS, register)
}

export function* watchWebSocketReconnected() {
  yield takeLatest(wsActions.WEBSOCKET_RECONNECTED, reregister)
}

//= ====================================
//  ROOT
// -------------------------------------

export const scoreboard_sagas = [
  fork(watchGetScoreboardFulfilled),
  fork(watchUpdateScoreboardPlays),
  fork(watchWebSocketReconnected)
]
