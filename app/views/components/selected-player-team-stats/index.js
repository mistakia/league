import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state, getSelectedPlayer } from '@core/selectors'

import SelectedPlayerTeamStats from './selected-player-team-stats'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_stats_state,
  (player_map, stats) => ({ team: player_map.get('team'), stats })
)

export default connect(map_state_to_props)(SelectedPlayerTeamStats)
