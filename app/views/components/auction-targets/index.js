import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getAuction,
  getAuctionTargetPlayers,
  auctionActions
} from '@core/auction'
import { getApp } from '@core/app'
import {
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague
} from '@core/rosters'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getAuction,
  getApp,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  (auction, app, players, team, rosteredPlayerIds) => ({
    valueType: auction.valueType,
    players,
    lineupPlayerIds: auction.lineupPlayers,
    lineupFeasible: auction.lineupFeasible,
    lineupPoints: auction.lineupPoints,
    hideRostered: auction.hideRostered,
    lineupBudget: auction.lineupBudget,
    vbaseline: app.vbaseline,
    team,
    rosteredPlayerIds
  })
)

const mapDispatchToProps = {
  toggleHideRostered: auctionActions.toggleHideRostered
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionTargets)
