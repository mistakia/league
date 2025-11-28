import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { get_request_history, get_app } from '@core/selectors'
import { seasons_actions } from './actions'
import { api_get_season } from '@core/api'
import { app_actions } from '@core/app'
import { current_season } from '@constants'

export function* load_season() {
  const { leagueId, year } = yield select(get_app)

  console.log({ leagueId, year })

  if (year === current_season.year) {
    return
  }

  const request_history = yield select(get_request_history)
  const key = `GET_SEASON_LEAGUE_${leagueId}_${year}`
  if (!request_history.has(key)) {
    yield call(api_get_season, { leagueId, year })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_season() {
  yield takeLatest(seasons_actions.LOAD_SEASON, load_season)
}

export function* watch_select_year() {
  yield takeLatest(app_actions.SELECT_YEAR, load_season)
}

//= ====================================
//  ROOT
// -------------------------------------

export const seasons_sagas = [fork(watch_load_season), fork(watch_select_year)]
