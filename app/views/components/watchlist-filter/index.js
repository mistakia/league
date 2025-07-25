import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { player_actions } from '@core/players'
import { get_players_state } from '@core/selectors'

import WatchlistFilter from './watchlist-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  watchlistOnly: players.get('watchlistOnly')
}))

const map_dispatch_to_props = {
  toggle: player_actions.toggle_watchlist_only
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(WatchlistFilter)
