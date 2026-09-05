import { Map, List } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_player_maps } from '@core/selectors'
import { player_actions } from '@core/players/actions'

import SelectedPlayerContent from './selected-player-content'

const map_state_to_props = createSelector(
  get_player_maps,
  (state) => state.getIn(['players', 'selected']),
  (player_maps, selected_player_id) => {
    const player_map = player_maps.get(selected_player_id, new Map())

    return {
      pid: selected_player_id,
      content_items: player_map.get('content_items', new List())
    }
  }
)

const map_dispatch_to_props = {
  load_player_content: player_actions.load_player_content
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerContent)
