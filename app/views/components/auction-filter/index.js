import { connect } from 'react-redux'

import { auctionActions } from '@core/auction'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: auctionActions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
