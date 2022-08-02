import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { getTransactions } from './selectors'
import { transactionsActions } from './actions'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'
import {
  fetchTransactions,
  fetchPlayers,
  getReleaseTransactions,
  getReserveTransactions
} from '@core/api'
import { getAllPlayers } from '@core/players'

export function* load({ payload }) {
  const { leagueId } = payload
  const transactions = yield select(getTransactions)
  const offset = transactions.items.size
  const types = transactions.types.toJS()
  const teams = transactions.teams.toJS()
  const params = {
    offset,
    limit: TRANSACTIONS_PER_LOAD,
    leagueId,
    types,
    teams
  }
  yield call(fetchTransactions, params)
}

export function* loadReleaseTransactions() {
  const { leagueId } = yield select(getApp)
  yield call(getReleaseTransactions, { leagueId })
}

export function* loadReserveTransactions() {
  const { leagueId, teamId } = yield select(getApp)
  yield call(getReserveTransactions, { leagueId, teamId })
}

export function* loadPlayers({ payload }) {
  const players = yield select(getAllPlayers)
  const missing = payload.data.filter((p) => !players.getIn([p.pid, 'fname']))
  if (missing.length) {
    const { leagueId } = yield select(getApp)
    yield call(fetchPlayers, { leagueId, pids: missing.map((p) => p.pid) })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadTransactions() {
  yield takeLatest(transactionsActions.LOAD_TRANSACTIONS, load)
}

export function* watchLoadNextTransactions() {
  yield takeLatest(transactionsActions.LOAD_NEXT_TRANSACTIONS, load)
}

export function* watchFilterTransactions() {
  yield takeLatest(transactionsActions.FILTER_TRANSACTIONS, load)
}

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, loadReleaseTransactions)
  yield takeLatest(appActions.AUTH_FULFILLED, loadReserveTransactions)
}

export function* watchGetTransactionsFulfilled() {
  yield takeLatest(transactionsActions.GET_TRANSACTIONS_FULFILLED, loadPlayers)
}

//= ====================================
//  ROOT
// -------------------------------------

export const transactionSagas = [
  fork(watchLoadTransactions),
  fork(watchLoadNextTransactions),
  fork(watchFilterTransactions),
  fork(watchAuthFulfilled),
  fork(watchGetTransactionsFulfilled)
]
