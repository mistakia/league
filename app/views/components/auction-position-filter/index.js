import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/auction'

import AuctionPositionFilter from './auction-position-filter'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  positions: auction.get('positions')
}))

export default connect(mapStateToProps)(AuctionPositionFilter)
