import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state } from '@core/auction'

import AuctionPositionFilter from './auction-position-filter'

const map_state_to_props = createSelector(get_auction_state, (auction) => ({
  positions: auction.get('positions')
}))

export default connect(map_state_to_props)(AuctionPositionFilter)
