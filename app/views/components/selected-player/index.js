import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, playerActions } from '@core/players'
import { getApp } from '@core/app'

import SelectedPlayer from './selected-player'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getApp,
  (player, app) => ({
    player,
    isLoggedIn: Boolean(app.userId)
  })
)

const mapDispatchToProps = {
  deselect: playerActions.deselectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectedPlayer)
