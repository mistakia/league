import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, isPlayerLocked } from '@core/selectors'

import PlayerSlot from './player-slot'

const map_state_to_props = createSelector(
  getPlayerById,
  isPlayerLocked,
  (playerMap, isLocked) => ({ playerMap, isLocked })
)

export default connect(map_state_to_props)(PlayerSlot)
