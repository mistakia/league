import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import { getPlayers } from '@core/selectors'

import WatchlistFilter from './watchlist-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  watchlistOnly: players.get('watchlistOnly')
}))

const mapDispatchToProps = {
  toggle: playerActions.toggleWatchlistOnly
}

export default connect(mapStateToProps, mapDispatchToProps)(WatchlistFilter)
