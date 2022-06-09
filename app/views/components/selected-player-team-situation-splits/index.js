import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/stats'
import { getSelectedPlayer } from '@core/players'

import SelectedPlayerTeamSituationSplits from './selected-player-team-situation-splits'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getStats,
  (playerMap, stats) => ({ team: playerMap.get('team'), stats })
)

export default connect(mapStateToProps)(SelectedPlayerTeamSituationSplits)
