import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getScoreboardByTeamId } from '@core/selectors'

import ScoreboardScoreTeam from './scoreboard-score-team'

const map_state_to_props = createSelector(
  getScoreboardByTeamId,
  (scoreboard) => ({
    scoreboard
  })
)

export default connect(map_state_to_props)(ScoreboardScoreTeam)
