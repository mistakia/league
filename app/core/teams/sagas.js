import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { teamActions } from './actions'
import { getApp, appActions } from '@core/app'
import {
  getTeams,
  putTeam,
  postTeams,
  deleteTeams,
  getLeagueTeamStats
} from '@core/api'
import { getStandingsYear, standingsActions } from '@core/standings'
import { notificationActions } from '@core/notifications'
import { transactionsActions } from '@core/transactions'
import { waiverActions } from '@core/waivers'
import { matchupsActions } from '@core/matchups'
import { rosterActions } from '@core/rosters'

export function* initTeams() {
  const { leagueId } = yield select(getApp)
  yield call(getTeams, { leagueId })
}

export function* loadTeams({ payload }) {
  const { leagueId } = payload
  const state = yield select()
  const isLoading = state.getIn(['teams', 'isLoading'])
  const isLoaded = state.getIn(['teams', 'isLoaded'])
  if (isLoading === leagueId || isLoaded === leagueId) {
    return
  }

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

export function* loadLeagueTeamStats({ payload }) {
  const year = yield select(getStandingsYear)
  const { leagueId } = yield select(getApp)
  yield call(loadTeams, { payload })
  yield call(getLeagueTeamStats, { leagueId, year })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, initTeams)
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

export function* watchLoadLeagueTeamStats() {
  yield takeLatest(teamActions.LOAD_LEAGUE_TEAM_STATS, loadLeagueTeamStats)
}

export function* watchStandingsSelectYear() {
  yield takeLatest(standingsActions.STANDINGS_SELECT_YEAR, loadLeagueTeamStats)
}

export function* watchLoadTransactions() {
  yield takeLatest(transactionsActions.LOAD_TRANSACTIONS, loadTeams)
}

export function* watchLoadWaivers() {
  yield takeLatest(waiverActions.LOAD_WAIVERS, loadTeams)
}

export function* watchLoadMatchups() {
  yield takeLatest(matchupsActions.LOAD_MATCHUPS, loadTeams)
}

export function* watchLoadRosters() {
  yield takeLatest(rosterActions.LOAD_ROSTERS, loadTeams)
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
  fork(watchDeleteTeamsFulfilled),

  fork(watchLoadLeagueTeamStats),
  fork(watchStandingsSelectYear),

  fork(watchLoadTransactions),
  fork(watchLoadWaivers),
  fork(watchLoadMatchups),
  fork(watchLoadRosters)
]
