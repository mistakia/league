import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

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
import { getPlayers } from '@core/players'
import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getAuction,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  getPlayers,
  getApp,
  getCurrentLeague,
  (auction, players, team, rosteredPlayerIds, playerState, app, league) => {
    const playersByPosition = {}
    for (const position of constants.positions) {
      if (!playersByPosition[position]) playersByPosition[position] = new List()
      playersByPosition[position] = players
        .filter((pMap) => pMap.get('pos') === position)
        .toList()
    }

    return {
      playersByPosition,
      players: players.toList(),
      lineupPlayerIds: auction.lineupPlayers,
      lineupFeasible: auction.lineupFeasible,
      lineupPoints: auction.lineupPoints,
      muted: auction.muted,
      searchValue: auction.search,
      isNominating:
        !auction.isPaused &&
        !auction.nominated_pid &&
        (auction.nominatingTeamId === app.teamId ||
          app.userId === league.commishid),
      team,
      rosteredPlayerIds,
      watchlist: playerState.get('watchlist')
    }
  }
)

const mapDispatchToProps = {
  search: auctionActions.search,
  toggleMuted: auctionActions.toggleMuted,
  select: auctionActions.select
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionTargets)
