import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getPlayers, playerActions } from '@core/players'

import PlayerWatchlistAction from './player-watchlist-action'

const mapStateToProps = createSelector(
  getPlayers,
  getApp,
  (players, app) => ({ watchlist: players.get('watchlist'), userId: app.userId })
)

const mapDispatchToProps = {
  toggle: playerActions.toggleWatchlist
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerWatchlistAction)
