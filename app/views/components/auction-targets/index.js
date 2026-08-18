import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import { fantasy_positions } from '#constants'
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
    for (const position of fantasy_positions) {
      if (!playersByPosition[position]) playersByPosition[position] = new List()
      playersByPosition[position] = players
        .filter((pMap) => pMap.get('primary_position') === position)
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
          app.userId === league.commissioner_user_id),
      team,
      rosteredPlayerIds,
      watchlist: playerState.get('watchlist'),
      show_qb: Boolean(
        league.starter_slots_quarterback || league.starter_slots_superflex
      ),
      show_rb: Boolean(
        league.starter_slots_running_back ||
          league.starter_slots_superflex ||
          league.starter_slots_running_back_wide_receiver_flex ||
          league.starter_slots_running_back_wide_receiver_tight_end_flex
      ),
      show_wr: Boolean(
        league.starter_slots_wide_receiver ||
          league.starter_slots_running_back_wide_receiver_flex ||
          league.starter_slots_running_back_wide_receiver_tight_end_flex ||
          league.starter_slots_wide_receiver_tight_end_flex ||
          league.starter_slots_superflex
      ),
      show_te: Boolean(
        league.starter_slots_tight_end ||
          league.starter_slots_running_back_wide_receiver_tight_end_flex ||
          league.starter_slots_wide_receiver_tight_end_flex ||
          league.starter_slots_superflex
      ),
      show_k: Boolean(league.starter_slots_kicker),
      show_dst: Boolean(league.starter_slots_defense_special_teams)
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
