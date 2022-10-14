import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { getSelectedPlayersView, playerActions } from '@core/players'
import { statActions } from './actions'
import { getChartedPlays } from '@core/api'
import { getCurrentLeague } from '@core/leagues'
import { getStats } from './selectors'
import Worker from 'workerize-loader?inline!../worker' // eslint-disable-line import/no-webpack-loader-syntax

export function* loadChartedPlays() {
  const selected_players_view = yield select(getSelectedPlayersView)
  const should_load = selected_players_view.fields.find((field) =>
    field.includes('stats.')
  )
  if (should_load) {
    const stats = yield select(getStats)
    const { years } = stats.toJS()
    yield call(getChartedPlays, { years })
  }
}

export function* filterPlays({ payload }) {
  if (payload.type === 'years') {
    yield call(loadChartedPlays)
  } else {
    yield call(calculateStats)
  }
}

export function* calculateStats() {
  const {
    plays,
    weeks,
    days,
    quarters,
    downs,
    qualifiers,
    yardline_start,
    yardline_end
  } = yield select(getStats)
  const league = yield select(getCurrentLeague)
  const filtered = plays.filter((play) => {
    if (!weeks.includes(play.week)) return false
    if (!days.includes(play.day)) return false
    if (!quarters.includes(play.qtr)) return false
    if (!downs.includes(play.dwn)) return false
    if (yardline_start !== 0 || yardline_end !== 100) {
      if (!play.ydl_100) return false
      if (play.ydl_100 < yardline_start || play.ydl_100 > yardline_end)
        return false
    }
    return true
  })
  const worker = new Worker()
  const result = yield call(worker.workerCalculateStatsFromPlays, {
    plays: filtered.toJS(),
    qualifiers: qualifiers.toJS(),
    league
  })
  worker.terminate()
  yield put(playerActions.setStats(result))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchSetPlayersView() {
  yield takeLatest(playerActions.SELECT_PLAYERS_VIEW, loadChartedPlays)
}

export function* watchGetChartedPlaysFulfilled() {
  yield takeLatest(statActions.GET_CHARTED_PLAYS_FULFILLED, calculateStats)
}

export function* watchUpdateQualifier() {
  yield takeLatest(statActions.UPDATE_QUALIFIER, calculateStats)
}

export function* watchFilterStats() {
  yield takeLatest(statActions.FILTER_STATS, filterPlays)
}

export function* watchFilterStatsYardline() {
  yield takeLatest(statActions.FILTER_STATS_YARDLINE, calculateStats)
}

//= ====================================
//  ROOT
// -------------------------------------

export const statSagas = [
  fork(watchSetPlayersView),
  fork(watchGetChartedPlaysFulfilled),
  fork(watchFilterStats),
  fork(watchFilterStatsYardline),
  fork(watchUpdateQualifier)
]
