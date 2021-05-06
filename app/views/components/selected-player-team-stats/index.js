import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/stats'
import { getSelectedPlayer } from '@core/players'

import SelectedPlayerTeamStats from './selected-player-team-stats'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getStats,
  (player, stats) => ({ player, stats })
)

export default connect(mapStateToProps)(SelectedPlayerTeamStats)
