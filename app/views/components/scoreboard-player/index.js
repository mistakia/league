import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getPlayerById,
  getScoreboardGamelogByPlayerId,
  get_scoreboard
} from '@core/selectors'

import ScoreboardPlayer from './scoreboard-player'

const map_state_to_props = createSelector(
  getPlayerById,
  getScoreboardGamelogByPlayerId,
  get_scoreboard,
  (player_map, gamelog, scoreboard) => ({
    player_map,
    gamelog,
    week: scoreboard.get('week')
  })
)

export default connect(map_state_to_props)(ScoreboardPlayer)
