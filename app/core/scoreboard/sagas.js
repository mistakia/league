import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getScoreboard, getScoreboardUpdated } from './selectors'
import { scoreboardActions } from './actions'
import { fetchScoreboard } from '@core/api'
import { send, wsActions } from '@core/ws'

export function * loadScoreboard () {
  const state = yield select(getScoreboard)
  const isLoaded = state.get('isLoaded')
  if (!isLoaded) {
    const week = state.get('week')
    yield call(fetchScoreboard, { week })
  }
}

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

export function * loadWeek () {
  const scoreboard = yield select(getScoreboard)
  const week = scoreboard.get('week')
  yield call(fetchScoreboard, { week })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadScoreboard () {
  yield takeLatest(scoreboardActions.LOAD_SCOREBOARD, loadScoreboard)
}

export function * watchGetScoreboardFulfilled () {
  yield takeLatest(scoreboardActions.GET_SCOREBOARD_FULFILLED, register)
}

export function * watchUpdateScoreboardPlays () {
  yield takeLatest(scoreboardActions.UPDATE_SCOREBOARD_PLAYS, register)
}

export function * watchWebSocketReconnected () {
  yield takeLatest(wsActions.WEBSOCKET_RECONNECTED, reregister)
}

export function * watchScoreboardSelectWeek () {
  yield takeLatest(scoreboardActions.SCOREBOARD_SELECT_WEEK, loadWeek)
}

//= ====================================
//  ROOT
// -------------------------------------

export const scoreboardSagas = [
  fork(watchLoadScoreboard),
  fork(watchGetScoreboardFulfilled),
  fork(watchUpdateScoreboardPlays),
  fork(watchWebSocketReconnected),
  fork(watchScoreboardSelectWeek)
]
