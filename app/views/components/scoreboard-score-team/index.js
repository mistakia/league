import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getScoreboardByTeamId } from '@core/selectors'

import ScoreboardScoreTeam from './scoreboard-score-team'

const mapStateToProps = createSelector(getScoreboardByTeamId, (scoreboard) => ({
  scoreboard
}))

export default connect(mapStateToProps)(ScoreboardScoreTeam)
