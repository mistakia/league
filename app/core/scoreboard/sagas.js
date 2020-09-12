import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getScoreboard, getScoreboardUpdated } from './selectors'
import { scoreboardActions } from './actions'
import { fetchScoreboard } from '@core/api'
import { send } from '@core/ws'

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

//= ====================================
//  ROOT
// -------------------------------------

export const scoreboardSagas = [
  fork(watchLoadScoreboard),
  fork(watchGetScoreboardFulfilled),
  fork(watchUpdateScoreboardPlays)
]
