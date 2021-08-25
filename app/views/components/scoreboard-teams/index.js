import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getScoreboard, getSelectedMatchupScoreboards } from '@core/scoreboard'

import ScoreboardTeams from './scoreboard-teams'

const mapStateToProps = createSelector(
  getSelectedMatchupScoreboards,
  getScoreboard,
  (scoreboards, scoreboardState) => ({
    scoreboards,
    week: scoreboardState.get('week')
  })
)

export default connect(mapStateToProps)(ScoreboardTeams)
