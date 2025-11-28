import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { transaction_types } from '@constants'
import { app_actions } from '@core/app'
import { get_app, get_transactions, get_player_maps } from '@core/selectors'
import { transactions_actions } from './actions'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'
import {
  api_get_transactions,
  api_get_players,
  api_get_release_transactions,
  api_get_reserve_transactions
} from '@core/api'

export function* load({ payload }) {
  const { leagueId } = payload
  const transactions = yield select(get_transactions)
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
  yield call(api_get_transactions, params)
}

export function* loadReleaseTransactions() {
  const { leagueId } = yield select(get_app)
  if (leagueId) yield call(api_get_release_transactions, { leagueId })
}

export function* loadReserveTransactions() {
  const { leagueId, teamId } = yield select(get_app)
  if (leagueId && teamId)
    yield call(api_get_reserve_transactions, { leagueId, teamId })
}

export function* loadPlayers({ payload }) {
  const players = yield select(get_player_maps)
  const missing = payload.data.filter((p) => !players.getIn([p.pid, 'fname']))
  if (missing.length) {
    const { leagueId } = yield select(get_app)
    yield call(api_get_players, { leagueId, pids: missing.map((p) => p.pid) })
  }
}

export function* load_recent_transactions() {
  const { leagueId } = yield select(get_app)
  const params = {
    leagueId,
    types: [
      transaction_types.ROSTER_ADD,
      transaction_types.ROSTER_RELEASE,
      transaction_types.POACHED,
      transaction_types.DRAFT,
      transaction_types.PRACTICE_ADD
    ],
    since: Math.round(Date.now() / 1000) - 2592000 // last 30 days
  }
  yield call(api_get_transactions, params)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadTransactions() {
  yield takeLatest(transactions_actions.LOAD_TRANSACTIONS, load)
}

export function* watchLoadNextTransactions() {
  yield takeLatest(transactions_actions.LOAD_NEXT_TRANSACTIONS, load)
}

export function* watchFilterTransactions() {
  yield takeLatest(transactions_actions.FILTER_TRANSACTIONS, load)
}

export function* watchAuthFulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, loadReleaseTransactions)
  yield takeLatest(app_actions.AUTH_FULFILLED, loadReserveTransactions)
}

export function* watchGetTransactionsFulfilled() {
  yield takeLatest(transactions_actions.GET_TRANSACTIONS_FULFILLED, loadPlayers)
}

export function* watchLoadRecentTransactions() {
  yield takeLatest(
    transactions_actions.LOAD_RECENT_TRANSACTIONS,
    load_recent_transactions
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const transaction_sagas = [
  fork(watchLoadTransactions),
  fork(watchLoadNextTransactions),
  fork(watchFilterTransactions),
  fork(watchAuthFulfilled),
  fork(watchGetTransactionsFulfilled),
  fork(watchLoadRecentTransactions)
]
