import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getScoreboardByTeamId } from '@core/scoreboard'

import ScoreboardTeam from './scoreboard-team'

const mapStateToProps = createSelector(
  getTeamById,
  getRosterByTeamId,
  getCurrentLeague,
  getScoreboardByTeamId,
  (team, roster, league, scoreboard) => ({ team, roster, league, scoreboard })
)

export default connect(
  mapStateToProps
)(ScoreboardTeam)
