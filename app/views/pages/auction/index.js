import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state } from '@core/selectors'
import { player_actions } from '@core/players'
import { league_actions } from '@core/leagues'
import { roster_actions } from '@core/rosters'

import AuctionPage from './auction'

const map_state_to_props = createSelector(get_auction_state, (auction) => ({
  transactions: auction.transactions,
  tids: auction.tids
}))

const map_dispatch_to_props = {
  load_all_players: player_actions.load_all_players,
  load_league: league_actions.load_league,
  load_rosters: roster_actions.load_rosters
}

export default connect(map_state_to_props, map_dispatch_to_props)(AuctionPage)
