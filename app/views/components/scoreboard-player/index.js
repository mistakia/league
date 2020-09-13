import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'
import { getStatsByPlayerId } from '@core/scoreboard'

import ScoreboardPlayer from './scoreboard-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getStatsByPlayerId,
  (player, scoreboard) => ({ player, scoreboard })
)

export default connect(
  mapStateToProps
)(ScoreboardPlayer)
