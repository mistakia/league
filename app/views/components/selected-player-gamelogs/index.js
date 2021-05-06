import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'
import { getGamelogsForSelectedPlayer } from '@core/stats'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getGamelogsForSelectedPlayer,
  (player, gamelogs) => ({ player, gamelogs })
)

export default connect(mapStateToProps)(SelectedPlayerGamelogs)
