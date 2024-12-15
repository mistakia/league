import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getScoreboard,
  getSelectedMatchupScoreboards,
  getTeamsForCurrentLeague
} from '@core/selectors'

import ScoreboardTeams from './scoreboard-teams'

const mapStateToProps = createSelector(
  getSelectedMatchupScoreboards,
  getScoreboard,
  getTeamsForCurrentLeague,
  (scoreboards, scoreboardState, teams) => ({
    scoreboards,
    week: scoreboardState.get('week'),
    teams
  })
)

export default connect(mapStateToProps)(ScoreboardTeams)
