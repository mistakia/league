import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_transactions } from '@core/selectors'
import { transactions_actions } from '@core/transactions'

import TransactionsPage from './transactions'

const map_state_to_props = createSelector(get_transactions, (transactions) => ({
  transactions: transactions.items,
  isPending: transactions.isPending,
  hasMore: transactions.hasMore
}))

const map_dispatch_to_props = {
  load: transactions_actions.load,
  load_next_transactions: transactions_actions.load_next_transactions
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(TransactionsPage)
