import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { getTeams } from '@core/api'

export function * loadTeams () {
  const { leagueId } = yield select(getApp)
  yield call(getTeams, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadTeams)
}

//= ====================================
//  ROOT
// -------------------------------------

export const teamSagas = [
  fork(watchAuthFulfilled)
]
