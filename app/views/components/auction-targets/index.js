import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, getPlayersForOptimalLineup } from '@core/auction'
import { getPlayersForWatchlist } from '@core/players'
import { getApp } from '@core/app'
import { getCurrentPlayers } from '@core/rosters'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getPlayersForWatchlist,
  getAuction,
  getApp,
  getPlayersForOptimalLineup,
  getCurrentPlayers,
  (players, auction, app, lineupPlayers, team) => ({
    players,
    lineupPlayerIds: auction.lineupPlayers,
    lineupFeasible: auction.lineupFeasible,
    lineupPoints: auction.lineupPoints,
    lineupBudget: auction.lineupBudget,
    lineupPlayers,
    vbaseline: app.vbaseline,
    team
  })
)

export default connect(
  mapStateToProps
)(AuctionTargets)
