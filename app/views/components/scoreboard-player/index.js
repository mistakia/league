import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getPlayerById,
  getScoreboardGamelogByPlayerId,
  getScoreboard
} from '@core/selectors'

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
