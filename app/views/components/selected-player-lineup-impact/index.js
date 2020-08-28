import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'
import { getApp } from '@core/app'

import SelectedPlayerLineupImpact from './selected-player-lineup-impact'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getApp,
  (player, app) => ({ player, isLoggedIn: !!app.userId })
)

export default connect(
  mapStateToProps
)(SelectedPlayerLineupImpact)
