import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer
} from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerSeasonStats from './selected-player-season-stats'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer,
  (playerMap, stats) => ({ playerMap, stats })
)

const mapDispatchToProps = {
  load: player_actions.load_player_gamelogs
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSeasonStats)
