import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getCurrentLeague, getAuction } from '@core/selectors'
import { auctionActions } from '@core/auction'
import { playerActions } from '@core/players'
import { leagueActions } from '@core/leagues'
import { rosterActions } from '@core/rosters'

import AuctionPage from './auction'

const mapStateToProps = createSelector(
  getAuction,
  get_app,
  getCurrentLeague,
  (auction, app, league) => ({
    transactions: auction.transactions,
    tids: auction.tids,
    isHosted: Boolean(league.hosted),
    isCommish: app.userId === league.commishid
  })
)

const mapDispatchToProps = {
  join: auctionActions.join,
  loadAllPlayers: playerActions.loadAllPlayers,
  load_league: leagueActions.load_league,
  loadRosters: rosterActions.loadRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPage)
