import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getScoreboard, getScoreboardUpdated } from './selectors'
import { scoreboardActions } from './actions'
import { send, wsActions } from '@core/ws'

export function * register () {
  const updated = yield select(getScoreboardUpdated)

  send({
    type: scoreboardActions.SCOREBOARD_REGISTER,
    payload: { updated }
  })
}

export function * reregister () {
  const state = yield select(getScoreboard)
  const isLoaded = state.get('isLoaded')
  if (isLoaded) {
    yield call(register)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchGetScoreboardFulfilled () {
  yield takeLatest(scoreboardActions.GET_SCOREBOARD_FULFILLED, register)
}

export function * watchUpdateScoreboardPlays () {
  yield takeLatest(scoreboardActions.UPDATE_SCOREBOARD_PLAYS, register)
}

export function * watchWebSocketReconnected () {
  yield takeLatest(wsActions.WEBSOCKET_RECONNECTED, reregister)
}

//= ====================================
//  ROOT
// -------------------------------------

export const scoreboardSagas = [
  fork(watchGetScoreboardFulfilled),
  fork(watchUpdateScoreboardPlays),
  fork(watchWebSocketReconnected)
]
