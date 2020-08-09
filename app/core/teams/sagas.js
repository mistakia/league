import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { teamActions } from './actions'
import { getApp, appActions } from '@core/app'
import { getTeams, putTeam } from '@core/api'
import { notificationActions } from '@core/notifications'

export function * loadTeams () {
  const { leagueId } = yield select(getApp)
  yield call(getTeams, { leagueId })
}

export function * updateTeam ({ payload }) {
  yield call(putTeam, payload)
}

export function * saveNotification () {
  yield put(notificationActions.show({
    message: 'Team setting saved',
    severity: 'success'
  }))
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

export function * watchPutTeamFulfilled () {
  yield takeLatest(teamActions.PUT_TEAM_FULFILLED, saveNotification)
}

//= ====================================
//  ROOT
// -------------------------------------

export const teamSagas = [
  fork(watchAuthFulfilled),
  fork(watchUpdateTeam),
  fork(watchPutTeamFulfilled)
]
