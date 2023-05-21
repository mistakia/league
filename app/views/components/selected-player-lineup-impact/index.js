import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, get_app } from '@core/selectors'

import SelectedPlayerLineupImpact from './selected-player-lineup-impact'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  get_app,
  (playerMap, app) => ({ playerMap, isLoggedIn: Boolean(app.userId) })
)

export default connect(mapStateToProps)(SelectedPlayerLineupImpact)
