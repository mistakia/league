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
import { constants } from '@common'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getAuction,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  (auction, players, team, rosteredPlayerIds) => {
    const playersByPosition = {}
    for (const position of constants.positions) {
      if (!playersByPosition[position]) playersByPosition[position] = {}
      playersByPosition[position] = players.filter((p) => p.pos === position)
    }

    return {
      valueType: auction.valueType,
      playersByPosition,
      lineupPlayerIds: auction.lineupPlayers,
      lineupFeasible: auction.lineupFeasible,
      lineupPoints: auction.lineupPoints,
      hideRostered: auction.hideRostered,
      muted: auction.muted,
      team,
      rosteredPlayerIds
    }
  }
)

const mapDispatchToProps = {
  toggleHideRostered: auctionActions.toggleHideRostered,
  toggleMuted: auctionActions.toggleMuted
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionTargets)
