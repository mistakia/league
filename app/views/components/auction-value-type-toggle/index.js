import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, auctionActions } from '@core/auction'

import AuctionValueTypeToggle from './auction-value-type-toggle'

const mapStateToProps = createSelector(
  getAuction,
  (auction) => ({
    valueType: auction.valueType
  })
)

const mapDispatchToProps = {
  setValueType: auctionActions.setValueType
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionValueTypeToggle)
