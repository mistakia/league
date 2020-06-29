import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { teamActions } from './actions'
import { getApp, appActions } from '@core/app'
import { getTeams, putTeam } from '@core/api'

export function * loadTeams () {
  const { leagueId } = yield select(getApp)
  yield call(getTeams, { leagueId })
}

export function * updateTeam ({ payload }) {
  yield call(putTeam, payload)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadTeams)
}

export function * watchUpdateTeam () {
  yield takeLatest(teamActions.UPDATE_TEAM, updateTeam)
}

//= ====================================
//  ROOT
// -------------------------------------

export const teamSagas = [
  fork(watchAuthFulfilled),
  fork(watchUpdateTeam)
]
