import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { getTransactions } from './selectors'
import { transactionsActions } from './actions'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'
import { fetchTransactions, getReleaseTransactions } from '@core/api'

export function * load () {
  const { leagueId } = yield select(getApp)
  const transactions = yield select(getTransactions)
  const offset = transactions.items.size
  const types = transactions.types.toJS()
  const teams = transactions.teams.toJS()
  const params = { offset, limit: TRANSACTIONS_PER_LOAD, leagueId, types, teams }
  yield call(fetchTransactions, params)
}

export function * loadReleaseTransactions () {
  const { leagueId } = yield select(getApp)
  yield call(getReleaseTransactions, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadTransactions () {
  yield takeLatest(transactionsActions.LOAD_TRANSACTIONS, load)
}

export function * watchLoadNextTransactions () {
  yield takeLatest(transactionsActions.LOAD_NEXT_TRANSACTIONS, load)
}

export function * watchFilterTransactions () {
  yield takeLatest(transactionsActions.FILTER_TRANSACTIONS, load)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadReleaseTransactions)
}

//= ====================================
//  ROOT
// -------------------------------------

export const transactionSagas = [
  fork(watchLoadTransactions),
  fork(watchLoadNextTransactions),
  fork(watchFilterTransactions),
  fork(watchAuthFulfilled)
]
