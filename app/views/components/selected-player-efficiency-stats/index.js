import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/selectors'

import SelectedPlayerEfficiencyStats from './selected-player-efficiency-stats'

const map_state_to_props = createSelector(getSelectedPlayer, (player_map) => ({
  player_map
}))

export default connect(map_state_to_props)(SelectedPlayerEfficiencyStats)
