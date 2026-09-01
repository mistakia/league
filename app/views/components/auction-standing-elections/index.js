import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state, getCurrentTeamRoster } from '@core/selectors'

import AuctionStandingElections from './auction-standing-elections'

const map_state_to_props = createSelector(
  get_auction_state,
  getCurrentTeamRoster,
  (auction, roster) => ({
    // The viewing team's own rows only. No other team's amount reaches this
    // client, the commissioner's included, because the route that supplies them
    // is scoped to the caller's team and has no parameter that widens it.
    standing_elections: auction.standing_elections,
    availableCap: roster.availableCap,
    availableSpace: roster.availableSpace
  })
)

export default connect(map_state_to_props)(AuctionStandingElections)
