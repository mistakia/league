import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { teamActions } from './actions'
import { appActions } from '@core/app'
import { get_app, get_request_history } from '@core/selectors'
import {
  getTeams,
  putTeam,
  postTeams,
  deleteTeams,
  getLeagueTeamStats
} from '@core/api'
import { notificationActions } from '@core/notifications'
import { transactionsActions } from '@core/transactions'
import { waiverActions } from '@core/waivers'
import { matchupsActions } from '@core/matchups'
import { roster_actions } from '@core/rosters'

export function* initTeams() {
  const { leagueId } = yield select(get_app)
  if (leagueId) yield call(getTeams, { leagueId })
}

export function* loadTeams() {
  const { leagueId, year } = yield select(get_app)
  const request_history = yield select(get_request_history)

  if (request_history.has(`GET_TEAMS_${leagueId}_${year}`)) {
    return
  }

  if (!leagueId) return

  yield call(getTeams, { leagueId, year })
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
  const { leagueId } = yield select(get_app)
  yield call(postTeams, { leagueId })
}

export function* deleteTeam({ payload }) {
  const { leagueId } = yield select(get_app)
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
  const { leagueId, year } = yield select(get_app)
  yield call(loadTeams)
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
  yield takeLatest(roster_actions.LOAD_ROSTERS, loadTeams)
}

export function* watchLoadTeams() {
  yield takeLatest(teamActions.LOAD_TEAMS, loadTeams)
}

export function* watch_select_year() {
  yield takeLatest(appActions.SELECT_YEAR, loadTeams)
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

  fork(watchLoadTransactions),
  fork(watchLoadWaivers),
  fork(watchLoadMatchups),
  fork(watchLoadRosters),
  fork(watchLoadTeams),
  fork(watch_select_year)
]
