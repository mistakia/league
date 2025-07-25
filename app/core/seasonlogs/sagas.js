import { fork, takeEvery, select, call } from 'redux-saga/effects'

import { api_get_nfl_team_seasonlogs } from '@core/api'
import { seasonlogs_actions } from './actions'
import { get_app, get_request_history } from '@core/selectors'

export function* load() {
  const request_history = yield select(get_request_history)
  const { leagueId } = yield select(get_app)
  const key = `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${leagueId}`
  if (!request_history.has(key)) {
    yield call(api_get_nfl_team_seasonlogs, { leagueId })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadNflTeamSeasonlogs() {
  yield takeEvery(seasonlogs_actions.LOAD_NFL_TEAM_SEASONLOGS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const seasonlog_sagas = [fork(watchLoadNflTeamSeasonlogs)]
