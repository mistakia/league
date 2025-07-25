import { connect } from 'react-redux'

import { transactions_actions } from '@core/transactions'

import Filter from '@components/filter'

const map_dispatch_to_props = {
  filter: transactions_actions.filter
}

export default connect(null, map_dispatch_to_props)(Filter)
