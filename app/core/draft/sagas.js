import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { draftActions } from './actions'
import { fetchDraft, postDraft } from '@core/api'
import { getDraft, getNextPick } from './selectors'

export function * loadDraft () {
  const { leagueId } = yield select(getApp)
  yield call(fetchDraft, { leagueId })
}

export function * draftPlayer () {
  const { selected } = yield select(getDraft)
  const { teamId, leagueId } = yield select(getApp)
  const { uid } = yield select(getNextPick)
  const params = { leagueId, playerId: selected, teamId, pickId: uid }
  yield call(postDraft, params)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadDraft () {
  yield takeLatest(draftActions.LOAD_DRAFT, loadDraft)
}

export function * watchDraftPlayer () {
  yield takeLatest(draftActions.DRAFT_PLAYER, draftPlayer)
}

//= ====================================
//  ROOT
// -------------------------------------

export const draftSagas = [
  fork(watchLoadDraft),
  fork(watchDraftPlayer)
]
