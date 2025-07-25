import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auction_actions } from '@core/auction'
import { get_auction_state } from '@core/selectors'

import AuctionCommissionerControls from './auction-commissioner-controls'

const map_state_to_props = createSelector(get_auction_state, (auction) => ({
  isPaused: auction.isPaused,
  pause_on_team_disconnect: auction.pause_on_team_disconnect
}))

const map_dispatch_to_props = {
  pause: auction_actions.pause,
  resume: auction_actions.resume,
  toggle_pause_on_team_disconnect:
    auction_actions.toggle_pause_on_team_disconnect
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionCommissionerControls)
