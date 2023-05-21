import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getGameStatusByPlayerId } from '@core/selectors'

import ScoreboardPlayerGameStatus from './scoreboard-player-game-status'

const mapStateToProps = createSelector(getGameStatusByPlayerId, (status) => ({
  status
}))

export default connect(mapStateToProps)(ScoreboardPlayerGameStatus)
