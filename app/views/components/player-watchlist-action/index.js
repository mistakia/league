import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'
import { playerActions } from '@core/players'

import PlayerWatchlistAction from './player-watchlist-action'

const mapStateToProps = createSelector(
  getPlayers,
  (state) => state.get('app'),
  (players, app) => ({
    watchlist: players.get('watchlist'),
    userId: app.userId
  })
)

const mapDispatchToProps = {
  toggle: playerActions.toggleWatchlist
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerWatchlistAction)
