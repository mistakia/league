import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { rosterActions } from './actions'
import { getRoster, getRosters, putRoster, postActivate, postDeactivate } from '@core/api'
import { getApp, appActions } from '@core/app'

export function * loadRoster ({ payload }) {
  const { teamId } = payload
  yield call(getRoster, { teamId })
}

export function * loadRosters () {
  const { leagueId } = yield select(getApp)
  yield call(getRosters, { leagueId })
}

export function * updateRoster ({ payload }) {
  const { teamId, leagueId } = yield select(getApp)
  yield call(putRoster, { teamId, leagueId, ...payload })
}

export function * activate ({ payload }) {
  const { teamId, leagueId } = yield select(getApp)
  yield call(postActivate, { teamId, leagueId, ...payload })
}

export function * deactivate ({ payload }) {
  const { teamId, leagueId } = yield select(getApp)
  yield call(postDeactivate, { teamId, leagueId, ...payload })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadRoster () {
  yield takeLatest(rosterActions.LOAD_ROSTER, loadRoster)
}

export function * watchLoadRosters () {
  yield takeLatest(rosterActions.LOAD_ROSTERS, loadRosters)
}

export function * watchUpdateRoster () {
  yield takeLatest(rosterActions.UPDATE_ROSTER, updateRoster)
}

export function * watchActivatePlayer () {
  yield takeLatest(rosterActions.ACTIVATE_PLAYER, activate)
}

export function * watchDeactivatePlayer () {
  yield takeLatest(rosterActions.DEACTIVATE_PLAYER, deactivate)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadRosters)
}

//= ====================================
//  ROOT
// -------------------------------------

export const rosterSagas = [
  fork(watchLoadRoster),
  fork(watchLoadRosters),
  fork(watchUpdateRoster),
  fork(watchActivatePlayer),
  fork(watchDeactivatePlayer),
  fork(watchAuthFulfilled)
]
