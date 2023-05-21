import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getPlayers } from '@core/selectors'
import { playerActions } from '@core/players'

import PlayerWatchlistAction from './player-watchlist-action'

const mapStateToProps = createSelector(getPlayers, get_app, (players, app) => ({
  watchlist: players.get('watchlist'),
  userId: app.userId
}))

const mapDispatchToProps = {
  toggle: playerActions.toggleWatchlist
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerWatchlistAction)
