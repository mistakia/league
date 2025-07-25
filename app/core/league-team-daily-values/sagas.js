import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { league_team_daily_values_actions } from './actions'
import { api_get_league_team_daily_values } from '@core/api'
import { get_app, get_request_history } from '@core/selectors'

export function* load() {
  const { leagueId } = yield select(get_app)

  const request_history = yield select(get_request_history)
  const key = `GET_LEAGUE_TEAM_DAILY_VALUES_${leagueId}`
  if (!request_history.has(key)) {
    yield call(api_get_league_team_daily_values, { leagueId })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_league_team_daily_values() {
  yield takeLatest(
    league_team_daily_values_actions.LOAD_LEAGUE_TEAM_DAILY_VALUES,
    load
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const league_team_daily_values_sagas = [
  fork(watch_load_league_team_daily_values)
]
