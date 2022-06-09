import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'
import { getScoreboardGamelogByPlayerId, getScoreboard } from '@core/scoreboard'

import ScoreboardPlayer from './scoreboard-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getScoreboardGamelogByPlayerId,
  getScoreboard,
  (playerMap, gamelog, scoreboard) => ({
    playerMap,
    gamelog,
    week: scoreboard.get('week')
  })
)

export default connect(mapStateToProps)(ScoreboardPlayer)
