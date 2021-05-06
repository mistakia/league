import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { teamActions } from './actions'
import { getApp, appActions } from '@core/app'
import { getTeams, putTeam, postTeams, deleteTeams } from '@core/api'
import { notificationActions } from '@core/notifications'

export function* loadTeams() {
  const { leagueId } = yield select(getApp)
  yield call(getTeams, { leagueId })
}

export function* updateTeam({ payload }) {
  yield call(putTeam, payload)
}

export function* saveNotification() {
  yield put(
    notificationActions.show({
      message: 'Team setting saved',
      severity: 'success'
    })
  )
}

export function* addTeam() {
  const { leagueId } = yield select(getApp)
  yield call(postTeams, { leagueId })
}

export function* deleteTeam({ payload }) {
  const { leagueId } = yield select(getApp)
  const { teamId } = payload
  yield call(deleteTeams, { leagueId, teamId })
}

export function* addNotification() {
  yield put(
    notificationActions.show({
      message: 'Team Added',
      severity: 'success'
    })
  )
}

export function* deleteNotification() {
  yield put(
    notificationActions.show({
      message: 'Team Deleted',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, loadTeams)
}

export function* watchUpdateTeam() {
  yield takeLatest(teamActions.UPDATE_TEAM, updateTeam)
}

export function* watchPutTeamFulfilled() {
  yield takeLatest(teamActions.PUT_TEAM_FULFILLED, saveNotification)
}

export function* watchDeleteTeam() {
  yield takeLatest(teamActions.DELETE_TEAM, deleteTeam)
}

export function* watchAddTeam() {
  yield takeLatest(teamActions.ADD_TEAM, addTeam)
}

export function* watchPostTeamsFulfilled() {
  yield takeLatest(teamActions.POST_TEAMS_FULFILLED, addNotification)
}

export function* watchDeleteTeamsFulfilled() {
  yield takeLatest(teamActions.DELETE_TEAMS_FULFILLED, deleteNotification)
}

//= ====================================
//  ROOT
// -------------------------------------

export const teamSagas = [
  fork(watchAuthFulfilled),
  fork(watchUpdateTeam),
  fork(watchPutTeamFulfilled),
  fork(watchDeleteTeam),
  fork(watchAddTeam),

  fork(watchPostTeamsFulfilled),
  fork(watchDeleteTeamsFulfilled)
]
