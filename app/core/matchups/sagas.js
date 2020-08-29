import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { getMatchups, postMatchups } from '@core/api'
import { matchupsActions } from './actions'

export function * loadMatchups () {
  const { leagueId } = yield select(getApp)
  yield call(getMatchups, { leagueId })
}

export function * generate ({ payload }) {
  yield call(postMatchups, payload)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchGenerateMatchups () {
  yield takeLatest(matchupsActions.GENERATE_MATCHUPS, generate)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadMatchups)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchupSagas = [
  fork(watchAuthFulfilled),
  fork(watchGenerateMatchups)
]
