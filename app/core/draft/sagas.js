import moment from 'moment'
import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { draftActions } from './actions'
import { fetchDraft, postDraft } from '@core/api'
import { getDraft, getNextPick } from './selectors'
import { getCurrentLeague } from '@core/leagues'

export function* loadDraft() {
  const { leagueId } = yield select(getApp)
  yield call(fetchDraft, { leagueId })
}

export function* draftPlayer() {
  const { selected } = yield select(getDraft)
  const { teamId, leagueId } = yield select(getApp)
  const { uid } = yield select(getNextPick)
  const params = { leagueId, playerId: selected, teamId, pickId: uid }
  yield call(postDraft, params)
}

export function* init() {
  const league = yield select(getCurrentLeague)
  if (league.ddate) {
    const start = moment(league.ddate, 'X')
    const totalPicks = league.nteams * 3
    const end = start.clone().add(totalPicks, 'day')
    if (moment().isBetween(start, end)) {
      yield call(fetchDraft, { leagueId: league.uid })
    }
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
