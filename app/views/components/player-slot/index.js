import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, isPlayerLocked } from '@core/players'

import PlayerSlot from './player-slot'

const mapStateToProps = createSelector(
  getPlayerById,
  isPlayerLocked,
  (player, isLocked) => ({ player, isLocked })
)

export default connect(
  mapStateToProps
)(PlayerSlot)
