import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/selectors'
import { auctionActions } from '@core/auction'
import { leagueActions } from '@core/leagues'

import AuctionControls from './auction-controls'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  tids: auction.tids
}))

const mapDispatchToProps = {
  join: auctionActions.join,
  load_league: leagueActions.load_league
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionControls)
