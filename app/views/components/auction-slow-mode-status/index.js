import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state } from '@core/selectors'

import AuctionSlowModeStatus from './auction-slow-mode-status'

const map_state_to_props = createSelector(get_auction_state, (auction) => ({
  is_slow_mode: auction.is_slow_mode,
  nominated_pid: auction.nominated_pid
}))

export default connect(map_state_to_props)(AuctionSlowModeStatus)
