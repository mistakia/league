import { call, takeLatest, fork } from 'redux-saga/effects'

import { rosterActions } from './actions'
import { getRoster } from '@core/api'

export function * loadRoster ({ payload }) {
  const { teamId } = payload
  yield call(getRoster, { teamId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadRoster () {
  yield takeLatest(rosterActions.LOAD_ROSTER, loadRoster)
}


//= ====================================
//  ROOT
// -------------------------------------

export const rosterSagas = [
  fork(watchLoadRoster)
]
