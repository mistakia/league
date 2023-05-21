import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer
} from '@core/selectors'
import { playerActions } from '@core/players'

import SelectedPlayerSeasonStats from './selected-player-season-stats'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer,
  (playerMap, stats) => ({ playerMap, stats })
)

const mapDispatchToProps = {
  load: playerActions.loadPlayerGamelogs
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSeasonStats)
