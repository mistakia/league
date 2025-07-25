import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { team_actions } from './actions'
import { app_actions } from '@core/app'
import { get_app, get_request_history } from '@core/selectors'
import {
  api_get_teams,
  api_put_team,
  api_post_teams,
  api_delete_teams,
  api_get_league_team_stats
} from '@core/api'
import { notification_actions } from '@core/notifications'
import { transactions_actions } from '@core/transactions'
import { waiver_actions } from '@core/waivers'
import { matchups_actions } from '@core/matchups'
import { roster_actions } from '@core/rosters'

export function* initTeams() {
  const { leagueId } = yield select(get_app)
  if (leagueId) yield call(api_get_teams, { leagueId })
}

export function* load_teams() {
  const { leagueId, year } = yield select(get_app)
  const request_history = yield select(get_request_history)

  if (request_history.has(`GET_TEAMS_${leagueId}_${year}`)) {
    return
  }

  if (!leagueId) return

  yield call(api_get_teams, { leagueId, year })
}

export function* updateTeam({ payload }) {
  yield call(api_put_team, payload)
}

export function* saveNotification() {
  yield put(
    notification_actions.show({
      message: 'Team setting saved',
      severity: 'success'
    })
  )
}

export function* addTeam() {
  const { leagueId } = yield select(get_app)
  yield call(api_post_teams, { leagueId })
}

export function* deleteTeam({ payload }) {
  const { leagueId } = yield select(get_app)
  const { teamId } = payload
  yield call(api_delete_teams, { leagueId, teamId })
}

export function* addNotification() {
  yield put(
    notification_actions.show({
      message: 'Team Added',
      severity: 'success'
    })
  )
}

export function* deleteNotification() {
  yield put(
    notification_actions.show({
      message: 'Team Deleted',
      severity: 'success'
    })
  )
}

export function* load_league_team_stats({ payload }) {
  const { leagueId, year } = yield select(get_app)
  yield call(load_teams)
  yield call(api_get_league_team_stats, { leagueId, year })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchAuthFulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, initTeams)
}

export function* watchUpdateTeam() {
  yield takeLatest(team_actions.UPDATE_TEAM, updateTeam)
}

export function* watchPutTeamFulfilled() {
  yield takeLatest(team_actions.PUT_TEAM_FULFILLED, saveNotification)
}

export function* watchDeleteTeam() {
  yield takeLatest(team_actions.DELETE_TEAM, deleteTeam)
}

export function* watchAddTeam() {
  yield takeLatest(team_actions.ADD_TEAM, addTeam)
}

export function* watchPostTeamsFulfilled() {
  yield takeLatest(team_actions.POST_TEAMS_FULFILLED, addNotification)
}

export function* watchDeleteTeamsFulfilled() {
  yield takeLatest(team_actions.DELETE_TEAMS_FULFILLED, deleteNotification)
}

export function* watchLoadLeagueTeamStats() {
  yield takeLatest(team_actions.LOAD_LEAGUE_TEAM_STATS, load_league_team_stats)
}

export function* watchLoadTransactions() {
  yield takeLatest(transactions_actions.LOAD_TRANSACTIONS, load_teams)
}

export function* watchLoadWaivers() {
  yield takeLatest(waiver_actions.LOAD_WAIVERS, load_teams)
}

export function* watchLoadMatchups() {
  yield takeLatest(matchups_actions.LOAD_MATCHUPS, load_teams)
}

export function* watchLoadRosters() {
  yield takeLatest(roster_actions.LOAD_ROSTERS, load_teams)
}

export function* watchLoadTeams() {
  yield takeLatest(team_actions.LOAD_TEAMS, load_teams)
}

export function* watch_select_year() {
  yield takeLatest(app_actions.SELECT_YEAR, load_teams)
}

//= ====================================
//  ROOT
// -------------------------------------

export const team_sagas = [
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
