import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getScoreboard,
  getStartersByMatchupId,
  getSelectedMatchupScoreboards
} from '@core/scoreboard'

import ScoreboardTeams from './scoreboard-teams'

const mapStateToProps = createSelector(
  getStartersByMatchupId,
  getSelectedMatchupScoreboards,
  getScoreboard,
  (starters, scoreboards, scoreboardState) => ({
    starters,
    scoreboards,
    week: scoreboardState.get('week')
  })
)

export default connect(
  mapStateToProps
)(ScoreboardTeams)
