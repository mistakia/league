import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getPlayerById,
  getScoreboardGamelogByPlayerId,
  get_scoreboard,
  get_player_live_projection
} from '@core/selectors'

import ScoreboardPlayer from './scoreboard-player'

const get_live_projection = (state, { pid }) => {
  const scoreboard = get_scoreboard(state)
  const week = scoreboard.get('week')
  const player_map = getPlayerById(state, { pid })
  return get_player_live_projection(state, { player_map, week })
}

const map_state_to_props = createSelector(
  getPlayerById,
  getScoreboardGamelogByPlayerId,
  get_scoreboard,
  get_live_projection,
  (player_map, gamelog, scoreboard, live_projection) => ({
    player_map,
    gamelog,
    week: scoreboard.get('week'),
    live_projection
  })
)

export default connect(map_state_to_props)(ScoreboardPlayer)
