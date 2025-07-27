import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, isPlayerLocked } from '@core/selectors'

import PlayerSlot from './player-slot'

const map_state_to_props = createSelector(
  getPlayerById,
  isPlayerLocked,
  (player_map, isLocked) => ({ player_map, isLocked })
)

export default connect(map_state_to_props)(PlayerSlot)
