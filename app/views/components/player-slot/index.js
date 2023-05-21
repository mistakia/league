import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, isPlayerLocked } from '@core/selectors'

import PlayerSlot from './player-slot'

const mapStateToProps = createSelector(
  getPlayerById,
  isPlayerLocked,
  (playerMap, isLocked) => ({ playerMap, isLocked })
)

export default connect(mapStateToProps)(PlayerSlot)
