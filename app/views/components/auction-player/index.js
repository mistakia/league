import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { isPlayerAvailable, isPlayerEligible } from '@core/rosters'
import { auctionActions } from '@core/auction'

import AuctionPlayer from './auction-player'

const mapStateToProps = createSelector(
  isPlayerAvailable,
  isPlayerEligible
  (isAvailable, isEligible) => ({ isAvailable, isEligible })
)

const mapDispatchToProps = {
  select: auctionActions.select
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionPlayer)
