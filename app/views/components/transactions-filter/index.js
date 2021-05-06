import { connect } from 'react-redux'

import { transactionsActions } from '@core/transactions'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: transactionsActions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
