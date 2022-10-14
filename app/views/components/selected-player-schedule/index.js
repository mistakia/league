import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getSelectedPlayerGames } from '@core/players'

import SelectedPlayerSchedule from './selected-player-schedule'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGames,
  (playerMap, games, seasonlogs) => ({ team: playerMap.get('team'), games })
)

export default connect(mapStateToProps)(SelectedPlayerSchedule)
