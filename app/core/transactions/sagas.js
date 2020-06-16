import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { getTransactions } from './selectors'
import { transactionsActions } from './actions'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'
import { fetchTransactions } from '@core/api'

export function * load () {
  const { leagueId } = yield select(getApp)
  const transactions = yield select(getTransactions)
  const offset = transactions.items.size
  const types = transactions.types.toJS()
  const teams = transactions.teams.toJS()
  const params = { offset, limit: TRANSACTIONS_PER_LOAD, leagueId, types, teams }
  yield call(fetchTransactions, params)
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


//= ====================================
//  ROOT
// -------------------------------------

export const transactionSagas = [
  fork(watchLoadTransactions),
  fork(watchLoadNextTransactions),
  fork(watchFilterTransactions)
]
