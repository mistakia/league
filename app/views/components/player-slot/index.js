import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import PlayerSlot from './player-slot'

const mapStateToProps = createSelector(
  getPlayerById,
  (player) => ({ player })
)

export default connect(
  mapStateToProps
)(PlayerSlot)
