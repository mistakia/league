import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'

import SelectedPlayerEfficiencyStats from './selected-player-efficiency-stats'

const mapStateToProps = createSelector(getSelectedPlayer, (playerMap) => ({
  playerMap
}))

export default connect(mapStateToProps)(SelectedPlayerEfficiencyStats)
