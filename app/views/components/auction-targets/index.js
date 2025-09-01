import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import {
  get_app,
  get_auction_state,
  get_auction_target_players,
  get_current_players_for_league,
  get_rostered_player_ids_for_current_league,
  get_players_state,
  get_current_league
} from '@core/selectors'
import { auction_actions } from '@core/auction'
import { constants } from '@libs-shared'

import AuctionTargets from './auction-targets'

const map_state_to_props = createSelector(
  get_auction_state,
  get_auction_target_players,
  get_current_players_for_league,
  get_rostered_player_ids_for_current_league,
  get_players_state,
  get_app,
  get_current_league,
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
        (auction.nominating_team_id === app.teamId ||
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

const map_dispatch_to_props = {
  search: auction_actions.search,
  toggleMuted: auction_actions.toggleMuted,
  select: auction_actions.select
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionTargets)
