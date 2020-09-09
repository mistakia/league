import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getProjectedScoreByTeamId } from '@core/scoreboard'

import ScoreboardTeam from './scoreboard-team'

const mapStateToProps = createSelector(
  getTeamById,
  getRosterByTeamId,
  getCurrentLeague,
  getProjectedScoreByTeamId,
  (team, roster, league, projectedScore) => ({ team, roster, league, projectedScore })
)

export default connect(
  mapStateToProps
)(ScoreboardTeam)
