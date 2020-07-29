import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { rosterActions } from './actions'
import { getRoster, getRosters, putRoster } from '@core/api'
import { getApp } from '@core/app'

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

//= ====================================
//  ROOT
// -------------------------------------

export const rosterSagas = [
  fork(watchLoadRoster),
  fork(watchLoadRosters),
  fork(watchUpdateRoster)
]
