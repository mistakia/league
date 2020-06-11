import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { teamActions } from './actions'
import { getTeams } from '@core/api'

export function * loadTeams () {
  const { leagueId } = yield select(getApp)
  yield call(getTeams, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadTeams () {
  yield takeLatest(teamActions.LOAD_TEAMS, loadTeams)
}


//= ====================================
//  ROOT
// -------------------------------------

export const teamSagas = [
  fork(watchLoadTeams)
]
