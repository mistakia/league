import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats, getSelectedPlayer } from '@core/selectors'

import SelectedPlayerTeamStats from './selected-player-team-stats'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getStats,
  (playerMap, stats) => ({ team: playerMap.get('team'), stats })
)

export default connect(mapStateToProps)(SelectedPlayerTeamStats)
