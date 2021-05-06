import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, auctionActions } from '@core/auction'

import EditableAuctionBudget from './editable-auction-budget'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  budget: auction.lineupBudget
}))

const mapDispatchToProps = {
  set: auctionActions.setBudget
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditableAuctionBudget)
