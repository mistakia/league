import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_transactions } from '@core/selectors'

import TransactionTypeFilter from './transaction-type-filter'

const map_state_to_props = createSelector(get_transactions, (transactions) => ({
  types: transactions.types
}))

export default connect(map_state_to_props)(TransactionTypeFilter)
