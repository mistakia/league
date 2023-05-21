import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTransactions } from '@core/selectors'
import { transactionsActions } from '@core/transactions'

import TransactionsPage from './transactions'

const mapStateToProps = createSelector(getTransactions, (transactions) => ({
  transactions: transactions.items,
  isPending: transactions.isPending,
  hasMore: transactions.hasMore
}))

const mapDispatchToProps = {
  load: transactionsActions.load,
  loadNext: transactionsActions.loadNext
}

export default connect(mapStateToProps, mapDispatchToProps)(TransactionsPage)
