import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_scoreboard,
  getSelectedMatchupScoreboards,
  get_teams_for_current_league
} from '@core/selectors'

import ScoreboardTeams from './scoreboard-teams'

const map_state_to_props = createSelector(
  getSelectedMatchupScoreboards,
  get_scoreboard,
  get_teams_for_current_league,
  (scoreboards, scoreboardState, teams) => ({
    scoreboards,
    week: scoreboardState.get('week'),
    teams
  })
)

export default connect(map_state_to_props)(ScoreboardTeams)
