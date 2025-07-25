import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_info_for_position } from '@core/selectors'

import AuctionTargetHeader from './auction-target-header'

const map_state_to_props = createSelector(
  get_auction_info_for_position,
  (info) => ({
    info
  })
)

export default connect(map_state_to_props)(AuctionTargetHeader)
