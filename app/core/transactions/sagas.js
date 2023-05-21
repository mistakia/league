import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { constants } from '@common'
import { appActions } from '@core/app'
import { get_app, getTransactions, get_player_maps } from '@core/selectors'
import { transactionsActions } from './actions'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'
import {
  fetchTransactions,
  fetchPlayers,
  getReleaseTransactions,
  getReserveTransactions
} from '@core/api'

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
  const { leagueId } = yield select(get_app)
  if (leagueId) yield call(getReleaseTransactions, { leagueId })
}

export function* loadReserveTransactions() {
  const { leagueId, teamId } = yield select(get_app)
  if (leagueId && teamId)
    yield call(getReserveTransactions, { leagueId, teamId })
}

export function* loadPlayers({ payload }) {
  const players = yield select(get_player_maps)
  const missing = payload.data.filter((p) => !players.getIn([p.pid, 'fname']))
  if (missing.length) {
    const { leagueId } = yield select(get_app)
    yield call(fetchPlayers, { leagueId, pids: missing.map((p) => p.pid) })
  }
}

export function* loadRecentTransactions() {
  const { leagueId } = yield select(get_app)
  const params = {
    leagueId,
    types: [
      constants.transactions.ROSTER_ADD,
      constants.transactions.ROSTER_RELEASE,
      constants.transactions.POACHED,
      constants.transactions.DRAFT,
      constants.transactions.PRACTICE_ADD
    ],
    since: Math.round(Date.now() / 1000) - 2592000 // last 30 days
  }
  yield call(fetchTransactions, params)
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

export function* watchLoadRecentTransactions() {
  yield takeLatest(
    transactionsActions.LOAD_RECENT_TRANSACTIONS,
    loadRecentTransactions
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const transactionSagas = [
  fork(watchLoadTransactions),
  fork(watchLoadNextTransactions),
  fork(watchFilterTransactions),
  fork(watchAuthFulfilled),
  fork(watchGetTransactionsFulfilled),
  fork(watchLoadRecentTransactions)
]
