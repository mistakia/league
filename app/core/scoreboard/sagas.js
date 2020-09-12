import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getScoreboard } from './selectors'
import { scoreboardActions } from './actions'
import { fetchScoreboard } from '@core/api'

export function * loadScoreboard () {
  const state = yield select(getScoreboard)
  const isLoaded = state.get('isLoaded')
  if (!isLoaded) {
    const week = state.get('week')
    yield call(fetchScoreboard, { week })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadScoreboard () {
  yield takeLatest(scoreboardActions.LOAD_SCOREBOARD, loadScoreboard)
}

//= ====================================
//  ROOT
// -------------------------------------

export const scoreboardSagas = [
  fork(watchLoadScoreboard)
]
