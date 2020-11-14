import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getPlayers, playerActions } from '@core/players'
import { statActions } from './actions'
import { getChartedPlays, getTeamStats } from '@core/api'
import { getStats } from './selectors'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * loadChartedPlays () {
  const players = yield select(getPlayers)
  const view = players.get('view')
  if (view === 'stats') {
    const stats = yield select(getStats)
    const { years } = stats.toJS()
    yield call(getChartedPlays, { years })
  }
}

export function * filterPlays ({ payload }) {
  if (payload.type === 'years') {
    yield call(loadChartedPlays)
  } else {
    yield call(calculateStats)
  }
}

export function * calculateStats () {
  const { plays, weeks, days, quarters, downs, qualifiers } = yield select(getStats)
  const filtered = plays.filter(play => {
    if (!weeks.includes(play.wk)) return false
    if (!days.includes(play.day)) return false
    if (!quarters.includes(play.qtr)) return false
    if (!downs.includes(play.dwn)) return false
    return true
  })
  const worker = new Worker()
  const result = yield call(worker.calculate, {
    plays: filtered.toJS(),
    qualifiers: qualifiers.toJS()
  })
  worker.terminate()
  yield put(playerActions.setStats(result))
}

export function * calculateTeamStats () {
  const { teamStats } = yield select(getStats)
  const worker = new Worker()
  const result = yield call(worker.calculateTeamPercentiles, teamStats.toJS())
  worker.terminate()
  yield put(statActions.setTeamStatsPercentiles(result))
}

export function * loadStats () {
  const { teamStats, plays } = yield select(getStats)
  if (!plays.size) yield fork(getChartedPlays)
  if (!teamStats.size) {
    yield call(getTeamStats)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchSetPlayersView () {
  yield takeLatest(playerActions.SET_PLAYERS_VIEW, loadChartedPlays)
}

export function * watchGetChartedPlaysFulfilled () {
  yield takeLatest(statActions.GET_CHARTED_PLAYS_FULFILLED, calculateStats)
}

export function * watchUpdateQualifier () {
  yield takeLatest(statActions.UPDATE_QUALIFIER, calculateStats)
}

export function * watchFilterStats () {
  yield takeLatest(statActions.FILTER_STATS, filterPlays)
}

export function * watchPlayersSelectPlayer () {
  yield takeLatest(playerActions.PLAYERS_SELECT_PLAYER, loadStats)
}

export function * watchGetTeamStatsFulfilled () {
  yield takeLatest(statActions.GET_TEAM_STATS_FULFILLED, calculateTeamStats)
}

//= ====================================
//  ROOT
// -------------------------------------

export const statSagas = [
  fork(watchSetPlayersView),
  fork(watchGetChartedPlaysFulfilled),
  fork(watchFilterStats),
  fork(watchPlayersSelectPlayer),
  fork(watchGetTeamStatsFulfilled),
  fork(watchUpdateQualifier)
]
