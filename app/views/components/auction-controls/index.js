import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, getCurrentLeague } from '@core/selectors'
import { auctionActions } from '@core/auction'
import { leagueActions } from '@core/leagues'

import AuctionControls from './auction-controls'

const mapStateToProps = createSelector(
  getAuction,
  (state) => state.getIn(['app', 'userId']),
  getCurrentLeague,
  (auction, userId, league) => ({
    tids: auction.tids,
    is_logged_in: Boolean(userId),
    auction_is_ended: auction.isComplete || league.free_agency_live_auction_end
  })
)

const mapDispatchToProps = {
  join: auctionActions.join,
  load_league: leagueActions.load_league
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionControls)
