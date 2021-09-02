import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getAuction,
  getAuctionTargetPlayers,
  auctionActions
} from '@core/auction'
import {
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague
} from '@core/rosters'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getAuction,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  (auction, players, team, rosteredPlayerIds) => ({
    valueType: auction.valueType,
    players,
    lineupPlayerIds: auction.lineupPlayers,
    lineupFeasible: auction.lineupFeasible,
    lineupPoints: auction.lineupPoints,
    hideRostered: auction.hideRostered,
    muted: auction.muted,
    lineupBudget: auction.lineupBudget,
    team,
    rosteredPlayerIds
  })
)

const mapDispatchToProps = {
  toggleHideRostered: auctionActions.toggleHideRostered,
  toggleMuted: auctionActions.toggleMuted
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionTargets)
