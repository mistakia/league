import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/selectors'
import { playerActions } from '@core/players'
import { leagueActions } from '@core/leagues'
import { rosterActions } from '@core/rosters'

import AuctionPage from './auction'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  transactions: auction.transactions,
  tids: auction.tids
}))

const mapDispatchToProps = {
  loadAllPlayers: playerActions.loadAllPlayers,
  load_league: leagueActions.load_league,
  loadRosters: rosterActions.loadRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPage)
