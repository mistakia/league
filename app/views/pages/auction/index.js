import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state, get_app, get_current_league } from '@core/selectors'
import { player_actions } from '@core/players'
import { league_actions } from '@core/leagues'
import { roster_actions } from '@core/rosters'
import { auction_actions } from '@core/auction'

import AuctionPage from './auction'

const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  get_current_league,
  (auction, app, league) => ({
    transactions: auction.transactions,
    teamId: app.teamId,
    is_hosted_league: Boolean(league.is_hosted)
  })
)

const map_dispatch_to_props = {
  load_all_players: player_actions.load_all_players,
  load_league: league_actions.load_league,
  load_rosters: roster_actions.load_rosters,
  load_auction_elections: auction_actions.load_auction_elections
}

export default connect(map_state_to_props, map_dispatch_to_props)(AuctionPage)
