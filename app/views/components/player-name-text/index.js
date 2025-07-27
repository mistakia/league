import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import PlayerNameText from './player-name-text'

const map_state_to_props = createSelector(getPlayerById, (player_map) => ({
  player_map
}))

export default connect(map_state_to_props)(PlayerNameText)
