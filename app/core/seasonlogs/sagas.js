import { fork, takeEvery, select, call } from 'redux-saga/effects'

import { getNflTeamSeasonlogs } from '@core/api'
import { seasonlogsActions } from './actions'
import { get_app, get_request_history } from '@core/selectors'

export function* load() {
  const request_history = yield select(get_request_history)
  const { leagueId } = yield select(get_app)
  const key = `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${leagueId}`
  if (!request_history.has(key)) {
    yield call(getNflTeamSeasonlogs, { leagueId })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadNflTeamSeasonlogs() {
  yield takeEvery(seasonlogsActions.LOAD_NFL_TEAM_SEASONLOGS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const seasonlogSagas = [fork(watchLoadNflTeamSeasonlogs)]
