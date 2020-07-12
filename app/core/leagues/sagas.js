import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { leagueActions } from './actions'
import { putLeague } from '@core/api'
import { getApp } from '@core/app'

export function * updateLeague ({ payload }) {
  const { token } = yield select(getApp)
  if (token) yield call(putLeague, payload)
  else yield put(leagueActions.set(payload))
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
