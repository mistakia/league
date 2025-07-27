import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer
} from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerSeasonStats from './selected-player-season-stats'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer,
  (player_map, stats) => ({ player_map, stats })
)

const map_dispatch_to_props = {
  load: player_actions.load_player_gamelogs
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerSeasonStats)
