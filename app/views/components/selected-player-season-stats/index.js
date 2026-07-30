import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_player_seasonlogs_for_selected_player } from '@core/selectors'

import SelectedPlayerSeasonStats from './selected-player-season-stats'

const map_state_to_props = createSelector(
  get_player_seasonlogs_for_selected_player,
  (player_seasonlogs) => ({
    player_seasonlogs
  })
)

export default connect(map_state_to_props)(SelectedPlayerSeasonStats)
