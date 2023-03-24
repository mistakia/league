import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { draftActions } from './actions'
import { fetchDraft, postDraft } from '@core/api'
import { getDraft, getNextPick } from './selectors'
import { getCurrentLeague } from '@core/leagues'
import { constants } from '@common'

dayjs.extend(isBetween)

export function* loadDraft() {
  const { leagueId } = yield select(getApp)
  yield call(fetchDraft, { leagueId })
}

export function* draftPlayer() {
  const { selected } = yield select(getDraft)
  const { teamId, leagueId } = yield select(getApp)
  const { uid } = yield select(getNextPick)
  const params = { leagueId, pid: selected, teamId, pickId: uid }
  yield call(postDraft, params)
}

export function* init() {
  const league = yield select(getCurrentLeague)
  if (league.draft_start && constants.fantasy_season_week === 0) {
    yield call(fetchDraft, { leagueId: league.uid })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadDraft() {
  yield takeLatest(draftActions.LOAD_DRAFT, loadDraft)
}

export function* watchDraftPlayer() {
  yield takeLatest(draftActions.DRAFT_PLAYER, draftPlayer)
}

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, init)
}

//= ====================================
//  ROOT
// -------------------------------------

export const draftSagas = [
  fork(watchLoadDraft),
  fork(watchDraftPlayer),
  fork(watchAuthFulfilled)
]
