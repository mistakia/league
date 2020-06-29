import { call, takeLatest, fork } from 'redux-saga/effects'

import { leagueActions } from './actions'
import { putLeague } from '@core/api'

export function * updateLeague ({ payload }) {
  yield call(putLeague, payload)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchUpdateLeague () {
  yield takeLatest(leagueActions.UPDATE_LEAGUE, updateLeague)
}

//= ====================================
//  ROOT
// -------------------------------------

export const leagueSagas = [
  fork(watchUpdateLeague)
]
