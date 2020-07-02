import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, playerActions } from '@core/players'

import PlayerWatchlistAction from './player-watchlist-action'

const mapStateToProps = createSelector(
  getPlayers,
  (players) => ({ watchlist: players.get('watchlist') })
)

const mapDispatchToProps = {
  toggle: playerActions.toggleWatchlist
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerWatchlistAction)
