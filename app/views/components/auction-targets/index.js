import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, getAuctionTargetPlayers } from '@core/auction'
import { getApp } from '@core/app'
import { getCurrentPlayers } from '@core/rosters'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getAuction,
  getApp,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  (auction, app, players, team) => ({
    players,
    lineupPlayerIds: auction.lineupPlayers,
    lineupFeasible: auction.lineupFeasible,
    lineupPoints: auction.lineupPoints,
    lineupBudget: auction.lineupBudget,
    vbaseline: app.vbaseline,
    team
  })
)

export default connect(
  mapStateToProps
)(AuctionTargets)
