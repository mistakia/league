import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuctionInfoForPosition } from '@core/selectors'

import AuctionTargetHeader from './auction-target-header'

const mapStateToProps = createSelector(getAuctionInfoForPosition, (info) => ({
  info
}))

export default connect(mapStateToProps)(AuctionTargetHeader)
