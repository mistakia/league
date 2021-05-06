import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions, getAuction } from '@core/auction'

import AuctionCommissionerControls from './auction-commissioner-controls'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  isPaused: auction.isPaused
}))

const mapDispatchToProps = {
  pause: auctionActions.pause,
  resume: auctionActions.resume
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionCommissionerControls)
