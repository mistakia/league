import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'
import { getStats } from '@core/stats'

import SelectedPlayerEfficiencyStats from './selected-player-efficiency-stats'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getStats,
  (player, stats) => ({ player, percentiles: stats.playsPercentiles })
)

export default connect(
  mapStateToProps
)(SelectedPlayerEfficiencyStats)
