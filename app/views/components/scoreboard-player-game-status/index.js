import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getGameStatusByPlayerId } from '@core/selectors'

import ScoreboardPlayerGameStatus from './scoreboard-player-game-status'

const map_state_to_props = createSelector(
  getGameStatusByPlayerId,
  (status) => ({
    status
  })
)

export default connect(map_state_to_props)(ScoreboardPlayerGameStatus)
