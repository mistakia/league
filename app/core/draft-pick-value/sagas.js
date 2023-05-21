import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { playerActions } from '@core/players'
import { get_app } from '@core/selectors'
import { getDraftPickValue } from '@core/api'
import { tradeActions } from '@core/trade'
import { draftPickValueActions } from './actions'

export function* loadDraftPickValue() {
  const { leagueId } = yield select(get_app)
  yield call(getDraftPickValue, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPlayersSelectPlayer() {
  yield takeLatest(playerActions.PLAYERS_SELECT_PLAYER, loadDraftPickValue)
}

export function* watchLoadTrades() {
  yield takeLatest(tradeActions.LOAD_TRADES, loadDraftPickValue)
}

export function* watchLoadDraftPickValue() {
  yield takeLatest(
    draftPickValueActions.LOAD_DRAFT_PICK_VALUE,
    loadDraftPickValue
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const draftPickValueSagas = [
  fork(watchPlayersSelectPlayer),
  fork(watchLoadTrades),
  fork(watchLoadDraftPickValue)
]
