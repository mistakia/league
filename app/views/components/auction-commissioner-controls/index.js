import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions, getAuction } from '@core/auction'

import AuctionCommissionerControls from './auction-commissioner-controls'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  isPaused: auction.isPaused,
  pause_on_team_disconnect: auction.pause_on_team_disconnect
}))

const mapDispatchToProps = {
  pause: auctionActions.pause,
  resume: auctionActions.resume,
  toggle_pause_on_team_disconnect:
    auctionActions.toggle_pause_on_team_disconnect
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionCommissionerControls)
