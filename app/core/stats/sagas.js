import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import {
  get_selected_players_page_view,
  get_current_league,
  get_stats_state,
  get_request_history
} from '@core/selectors'
import { player_actions } from '@core/players'
import { stat_actions } from './actions'
import { api_get_charted_plays } from '@core/api'

export function* loadChartedPlays() {
  const selected_players_page_view = yield select(
    get_selected_players_page_view
  )
  const should_load = selected_players_page_view.fields.find((field) =>
    field.includes('stats.')
  )

  if (should_load) {
    const request_history = yield select(get_request_history)
    const stats = yield select(get_stats_state)
    const { years } = stats.toJS()

    const request_key = `GET_CHARTED_PLAYS_${years.join('_')}`

    if (request_history.has(request_key)) {
      return
    }

    yield call(api_get_charted_plays, { years })
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
  } = yield select(get_stats_state)
  const league = yield select(get_current_league)
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
  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  const result = yield call(worker.workerCalculateStatsFromPlays, {
    plays: filtered.toJS(),
    qualifiers: qualifiers.toJS(),
    league
  })
  worker.terminate()
  yield put(player_actions.set_stats(result))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_init_charted_plays() {
  yield takeLatest(stat_actions.INIT_CHARTED_PLAYS, loadChartedPlays)
}

export function* watchSetPlayersView() {
  yield takeLatest(player_actions.SELECT_PLAYERS_PAGE_VIEW, loadChartedPlays)
}

export function* watchGetChartedPlaysFulfilled() {
  yield takeLatest(stat_actions.GET_CHARTED_PLAYS_FULFILLED, calculateStats)
}

export function* watchUpdateQualifier() {
  yield takeLatest(stat_actions.UPDATE_QUALIFIER, calculateStats)
}

export function* watchFilterStats() {
  yield takeLatest(stat_actions.FILTER_STATS, filterPlays)
}

export function* watchFilterStatsYardline() {
  yield takeLatest(stat_actions.FILTER_STATS_YARDLINE, calculateStats)
}

//= ====================================
//  ROOT
// -------------------------------------

export const stat_sagas = [
  fork(watchSetPlayersView),
  fork(watch_init_charted_plays),
  fork(watchGetChartedPlaysFulfilled),
  fork(watchFilterStats),
  fork(watchFilterStatsYardline),
  fork(watchUpdateQualifier)
]
