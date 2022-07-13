import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, playerActions } from '@core/players'
import { getGamelogsForSelectedPlayer } from '@core/stats'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getGamelogsForSelectedPlayer,
  (playerMap, gamelogs) => ({ playerMap, gamelogs })
)

const mapDispatchToProps = {
  load: playerActions.loadPlayerGamelogs
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerGamelogs)
