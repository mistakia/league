import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { draftActions } from './actions'
import { getDraft } from '@core/api'

export function * loadDraft () {
  const { leagueId } = yield select(getApp)
  yield call(getDraft, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadDraft () {
  yield takeLatest(draftActions.LOAD_DRAFT, loadDraft)
}


//= ====================================
//  ROOT
// -------------------------------------

export const draftSagas = [
  fork(watchLoadDraft)
]
