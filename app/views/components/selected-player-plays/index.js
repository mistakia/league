import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/selectors'
import { plays_views_actions } from '@core/plays-view'

import SelectedPlayerPlays from './selected-player-plays'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  (state) => state.get('selected_player_plays_request'),
  (player_map, selected_player_plays_request) => ({
    player_map,
    selected_player_plays_request
  })
)

const map_dispatch_to_props = {
  send_plays_request: plays_views_actions.selected_player_plays_request
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerPlays)
