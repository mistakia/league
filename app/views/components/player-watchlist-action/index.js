import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayerWatchlistAction from './player-watchlist-action'

const map_state_to_props = createSelector(
  get_players_state,
  (state) => state.get('app'),
  (players, app) => ({
    watchlist: players.get('watchlist'),
    userId: app.userId
  })
)

const map_dispatch_to_props = {
  toggle: player_actions.toggle_watchlist
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PlayerWatchlistAction)
