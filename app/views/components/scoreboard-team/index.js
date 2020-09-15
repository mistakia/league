import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'
import { getScoreboardByTeamId, getScoreboardRosterByTeamId } from '@core/scoreboard'

import ScoreboardTeam from './scoreboard-team'

const mapStateToProps = createSelector(
  getTeamById,
  getScoreboardRosterByTeamId,
  getCurrentLeague,
  getScoreboardByTeamId,
  (team, roster, league, scoreboard) => ({ team, roster, league, scoreboard })
)

export default connect(
  mapStateToProps
)(ScoreboardTeam)
