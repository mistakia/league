import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import {
  get_app,
  getAuction,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  getPlayers,
  getCurrentLeague
} from '@core/selectors'
import { auctionActions } from '@core/auction'
import { constants } from '@libs-shared'

import AuctionTargets from './auction-targets'

const mapStateToProps = createSelector(
  getAuction,
  getAuctionTargetPlayers,
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  getPlayers,
  get_app,
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
      muted: auction.muted,
      searchValue: auction.search,
      nominated_pid: auction.nominated_pid,
      isNominating:
        !auction.isPaused &&
        !auction.nominated_pid &&
        (auction.nominatingTeamId === app.teamId ||
          app.userId === league.commishid),
      team,
      rosteredPlayerIds,
      watchlist: playerState.get('watchlist'),
      show_qb: Boolean(league.sqb || league.sqbrbwrte),
      show_rb: Boolean(
        league.srb || league.sqbrbwrte || league.srbwr || league.srbwrte
      ),
      show_wr: Boolean(
        league.swr ||
          league.srbwr ||
          league.srbwrte ||
          league.swrte ||
          league.sqbrbwrte
      ),
      show_te: Boolean(
        league.ste || league.srbwrte || league.swrte || league.sqbrbwrte
      ),
      show_k: Boolean(league.sk),
      show_dst: Boolean(league.sdst)
    }
  }
)

const mapDispatchToProps = {
  search: auctionActions.search,
  toggleMuted: auctionActions.toggleMuted,
  select: auctionActions.select
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionTargets)
