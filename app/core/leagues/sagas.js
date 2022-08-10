import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { leagueActions } from './actions'
import { putLeague, getLeague } from '@core/api'
import { getApp } from '@core/app'
import { notificationActions } from '@core/notifications'
import { teamActions } from '@core/teams'
import { rosterActions } from '@core/rosters'
import { getLeagueById } from './selectors'

export function* loadLeague({ payload }) {
  const { leagueId } = payload
  const league = yield select(getLeagueById, { lid: leagueId })
  if (league.isLoading || league.isLoaded) {
    return
  }

  yield call(getLeague, { leagueId })
}

export function* updateLeague({ payload }) {
  const { token } = yield select(getApp)
  if (token) yield call(putLeague, payload)
  else yield put(leagueActions.set(payload))
}

export function* saveNotification() {
  yield put(
    notificationActions.show({
      message: 'League setting saved',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateLeague() {
  yield takeLatest(leagueActions.UPDATE_LEAGUE, updateLeague)
}

export function* watchPutLeagueFulfilled() {
  yield takeLatest(leagueActions.PUT_LEAGUE_FULFILLED, saveNotification)
}

export function* watchLoadLeagueTeamStats() {
  yield takeLatest(teamActions.LOAD_LEAGUE_TEAM_STATS, loadLeague)
}

export function* watchLoadRosters() {
  yield takeLatest(rosterActions.LOAD_ROSTERS, loadLeague)
}

//= ====================================
//  ROOT
// -------------------------------------

export const leagueSagas = [
  fork(watchUpdateLeague),
  fork(watchPutLeagueFulfilled),
  fork(watchLoadLeagueTeamStats),
  fork(watchLoadRosters)
]
