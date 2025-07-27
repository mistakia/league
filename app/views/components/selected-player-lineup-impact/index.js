import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, get_app } from '@core/selectors'

import SelectedPlayerLineupImpact from './selected-player-lineup-impact'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_app,
  (player_map, app) => ({ player_map, is_logged_in: Boolean(app.userId) })
)

export default connect(map_state_to_props)(SelectedPlayerLineupImpact)
