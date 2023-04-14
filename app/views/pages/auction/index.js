import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { auctionActions, getAuction } from '@core/auction'
import { getCurrentLeague } from '@core/leagues'
import { playerActions } from '@core/players'

import AuctionPage from './auction'

const mapStateToProps = createSelector(
  getAuction,
  getApp,
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
  loadAllPlayers: playerActions.loadAllPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPage)
