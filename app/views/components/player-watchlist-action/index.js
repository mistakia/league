import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'
import { player_actions } from '@core/players'

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
  toggle: player_actions.toggle_watchlist
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerWatchlistAction)
