import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { getMatchups } from '@core/api'
import { matchupsActions } from './actions'

export function * loadMatchups () {
  const { leagueId } = yield select(getApp)
  yield call(getMatchups, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadMatchups () {
  yield takeLatest(matchupsActions.LOAD_MATCHUPS, loadMatchups)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchupSagas = [
  fork(watchLoadMatchups)
]
