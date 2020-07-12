import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/stats'
import { getSelectedPlayer } from '@core/players'

import SelectedPlayerTeamPositionSplits from './selected-player-team-position-splits'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getStats,
  (player, stats) => ({ player, stats })
)

export default connect(
  mapStateToProps
)(SelectedPlayerTeamPositionSplits)
