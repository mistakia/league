import { fork, takeLatest, select, call } from 'redux-saga/effects'

import { getNflTeamSeasonlogs, getRequestHistory } from '@core/api'
import { seasonlogsActions } from './actions'
import { getApp } from '@core/app'

export function* load() {
  const request_history = yield select(getRequestHistory)
  const { leagueId } = yield select(getApp)
  const key = `GET_NFL_TEAM_SEASONLOGS_LEAGUE_${leagueId}`
  if (!request_history.has(key)) {
    yield call(getNflTeamSeasonlogs, { leagueId })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadNflTeamSeasonlogs() {
  yield takeLatest(seasonlogsActions.LOAD_NFL_TEAM_SEASONLOGS, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const seasonlogSagas = [fork(watchLoadNflTeamSeasonlogs)]
