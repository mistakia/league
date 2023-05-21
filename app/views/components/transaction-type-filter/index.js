import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTransactions } from '@core/selectors'

import TransactionTypeFilter from './transaction-type-filter'

const mapStateToProps = createSelector(getTransactions, (transactions) => ({
  types: transactions.types
}))

export default connect(mapStateToProps)(TransactionTypeFilter)
