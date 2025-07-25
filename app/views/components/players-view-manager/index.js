import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_player_fields } from '@core/player-fields'

import PlayersViewManager from './players-view-manager'

const map_state_to_props = createSelector(get_player_fields, (fields) => ({
  fields
}))

export default connect(map_state_to_props)(PlayersViewManager)
