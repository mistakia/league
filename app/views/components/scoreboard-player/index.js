import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'
import { getStatsByPlayerId, getScoreboard } from '@core/scoreboard'

import ScoreboardPlayer from './scoreboard-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getStatsByPlayerId,
  getScoreboard,
  (player, stats, scoreboard) => ({ player, stats, week: scoreboard.get('week') })
)

export default connect(
  mapStateToProps
)(ScoreboardPlayer)
