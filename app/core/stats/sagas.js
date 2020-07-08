import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getPlayers, playerActions } from '@core/players'
import { statActions } from './actions'
import { getPlays } from '@core/api'
import { getStats } from './selectors'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * loadPlays () {
  const players = yield select(getPlayers)
  const view = players.get('view')
  if (view === 'stats') {
    const stats = yield select(getStats)
    const { years } = stats.toJS()
    yield call(getPlays, { years })
  }
}

export function * filterPlays ({ payload }) {
  if (payload.type === 'years') {
    yield call(loadPlays)
  } else {
    yield call(calculateStats)
  }
}

export function * calculateStats () {
  const { plays, weeks, days, quarters, downs } = yield select(getStats)
  const filtered = plays.filter(play => {
    if (!weeks.includes(play.wk)) return false
    if (!days.includes(play.day)) return false
    if (!quarters.includes(play.qtr)) return false
    if (!downs.includes(play.dwn)) return false
    return true
  })
  const worker = new Worker()
  const result = yield call(worker.calculate, filtered.toJS())
  yield put(playerActions.setStats(result))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchSetPlayersView () {
  yield takeLatest(playerActions.SET_PLAYERS_VIEW, loadPlays)
}

export function * watchGetPlaysFulfilled () {
  yield takeLatest(statActions.GET_PLAYS_FULFILLED, calculateStats)
}

export function * watchFilterStats () {
  yield takeLatest(statActions.FILTER_STATS, filterPlays)
}

//= ====================================
//  ROOT
// -------------------------------------

export const statSagas = [
  fork(watchSetPlayersView),
  fork(watchGetPlaysFulfilled),
  fork(watchFilterStats)
]
