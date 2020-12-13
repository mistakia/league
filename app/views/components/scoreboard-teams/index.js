import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStartersByMatchupId, getSelectedMatchupScoreboards } from '@core/scoreboard'

import ScoreboardTeams from './scoreboard-teams'

const mapStateToProps = createSelector(
  getStartersByMatchupId,
  getSelectedMatchupScoreboards,
  (starters, scoreboards) => ({ starters, scoreboards })
)

export default connect(
  mapStateToProps
)(ScoreboardTeams)
