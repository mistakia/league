import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getScoreboard, getSelectedMatchupScoreboards } from '@core/selectors'

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
