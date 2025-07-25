import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state, get_current_league } from '@core/selectors'
import { auction_actions } from '@core/auction'
import { league_actions } from '@core/leagues'

import AuctionControls from './auction-controls'

const map_state_to_props = createSelector(
  get_auction_state,
  (state) => state.getIn(['app', 'userId']),
  get_current_league,
  (auction, userId, league) => ({
    tids: auction.tids,
    is_logged_in: Boolean(userId),
    auction_is_ended: auction.isComplete || league.free_agency_live_auction_end
  })
)

const map_dispatch_to_props = {
  join: auction_actions.join,
  load_league: league_actions.load_league
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionControls)
