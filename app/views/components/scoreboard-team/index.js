import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_team_by_id_for_year,
  getCurrentLeague,
  getScoreboardByTeamId,
  getScoreboardRosterByTeamId
} from '@core/selectors'

import ScoreboardTeam from './scoreboard-team'

const mapStateToProps = createSelector(
  get_team_by_id_for_year,
  getScoreboardRosterByTeamId,
  getCurrentLeague,
  getScoreboardByTeamId,
  (team, roster, league, scoreboard) => ({ team, roster, league, scoreboard })
)

export default connect(mapStateToProps)(ScoreboardTeam)
