import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state, auction_actions } from '@core/auction'

import EditableAuctionBudget from './editable-auction-budget'

const map_state_to_props = createSelector(get_auction_state, (auction) => ({
  budget: auction.lineupBudget
}))

const map_dispatch_to_props = {
  set: auction_actions.setBudget
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(EditableAuctionBudget)
