import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
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

export function * watchLoadMatchups () {
  yield takeLatest(matchupsActions.LOAD_MATCHUPS, loadMatchups)
}

export function * watchGenerateMatchups () {
  yield takeLatest(matchupsActions.GENERATE_MATCHUPS, generate)
}

//= ====================================
//  ROOT
// -------------------------------------

export const matchupSagas = [
  fork(watchLoadMatchups),
  fork(watchGenerateMatchups)
]
