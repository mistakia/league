import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { isPlayerAvailable, isPlayerEligible } from '@core/rosters'
import { auctionActions } from '@core/auction'

import AuctionPlayer from './auction-player'

const mapStateToProps = createSelector(
  isPlayerAvailable,
  isPlayerEligible,
  getApp,
  (isAvailable, isEligible, app) => ({ isAvailable, isEligible, vbaseline: app.vbaseline })
)

const mapDispatchToProps = {
  select: auctionActions.select
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionPlayer)
