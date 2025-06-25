import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { player_actions } from '@core/players'
import { getPlayers } from '@core/selectors'

import WatchlistFilter from './watchlist-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  watchlistOnly: players.get('watchlistOnly')
}))

const mapDispatchToProps = {
  toggle: player_actions.toggle_watchlist_only
}

export default connect(mapStateToProps, mapDispatchToProps)(WatchlistFilter)
