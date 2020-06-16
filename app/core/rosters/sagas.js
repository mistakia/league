import { call, takeLatest, fork } from 'redux-saga/effects'

import { rosterActions } from './actions'
import { getRoster, getRosters } from '@core/api'

export function * loadRoster ({ payload }) {
  const { teamId } = payload
  yield call(getRoster, { teamId })
}

export function * loadRosters () {
  const { leagueId } = yield select(getApp)
  yield call(getRosters, { leagueId })
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


//= ====================================
//  ROOT
// -------------------------------------

export const rosterSagas = [
  fork(watchLoadRoster),
  fork(watchLoadRosters)
]
