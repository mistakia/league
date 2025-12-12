import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer,
  get_player_seasonlogs_for_selected_player
} from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerSeasonStats from './selected-player-season-stats'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getGamesByYearForSelectedPlayer,
  get_player_seasonlogs_for_selected_player,
  (player_map, stats, player_seasonlogs) => ({
    player_map,
    stats,
    player_seasonlogs
  })
)

const map_dispatch_to_props = {
  load: player_actions.load_player_gamelogs,
  load_seasonlogs: player_actions.load_player_seasonlogs
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerSeasonStats)
