import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/selectors'
import { auctionActions } from '@core/auction'
import { leagueActions } from '@core/leagues'

import AuctionControls from './auction-controls'

const mapStateToProps = createSelector(
  getAuction,
  (state) => state.get('userId'),
  (auction, userId) => ({
    tids: auction.tids,
    is_logged_in: Boolean(userId)
  })
)

const mapDispatchToProps = {
  join: auctionActions.join,
  load_league: leagueActions.load_league
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionControls)
