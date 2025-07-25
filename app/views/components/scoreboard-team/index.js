import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_team_by_id_for_year,
  get_current_league,
  getScoreboardByTeamId,
  getScoreboardRosterByTeamId
} from '@core/selectors'

import ScoreboardTeam from './scoreboard-team'

const map_state_to_props = createSelector(
  get_team_by_id_for_year,
  getScoreboardRosterByTeamId,
  get_current_league,
  getScoreboardByTeamId,
  (team, roster, league, scoreboard) => ({ team, roster, league, scoreboard })
)

export default connect(map_state_to_props)(ScoreboardTeam)
