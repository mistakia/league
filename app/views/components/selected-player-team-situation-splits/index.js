import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state, getSelectedPlayer } from '@core/selectors'

import SelectedPlayerTeamSituationSplits from './selected-player-team-situation-splits'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_stats_state,
  (playerMap, stats) => ({ team: playerMap.get('team'), stats })
)

export default connect(map_state_to_props)(SelectedPlayerTeamSituationSplits)
