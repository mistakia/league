import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamById,
  getCurrentLeague,
  getScoreboardByTeamId,
  getScoreboardRosterByTeamId
} from '@core/selectors'

import ScoreboardTeam from './scoreboard-team'

const mapStateToProps = createSelector(
  getTeamById,
  getScoreboardRosterByTeamId,
  getCurrentLeague,
  getScoreboardByTeamId,
  (team, roster, league, scoreboard) => ({ team, roster, league, scoreboard })
)

export default connect(mapStateToProps)(ScoreboardTeam)
