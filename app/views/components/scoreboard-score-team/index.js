import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getProjectedScoreByTeamId } from '@core/scoreboard'

import ScoreboardScoreTeam from './scoreboard-score-team'

const mapStateToProps = createSelector(
  getProjectedScoreByTeamId,
  (projectedScore) => ({ projectedScore })
)

export default connect(
  mapStateToProps
)(ScoreboardScoreTeam)
