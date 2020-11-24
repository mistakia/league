import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStartersByMatchupId } from '@core/scoreboard'
import { getSelectedMatchupTeams } from '@core/matchups'

import ScoreboardTeams from './scoreboard-teams'

const mapStateToProps = createSelector(
  getStartersByMatchupId,
  getSelectedMatchupTeams,
  (starters, teams) => ({ starters, teams })
)

export default connect(
  mapStateToProps
)(ScoreboardTeams)
