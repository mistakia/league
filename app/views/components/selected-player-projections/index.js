import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerSeasonProjections from './selected-player-projections'

const map_state_to_props = createSelector(getSelectedPlayer, (playerMap) => ({
  playerMap
}))

const map_dispatch_to_props = {
  load: player_actions.load_player_projections
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerSeasonProjections)
