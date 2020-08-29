import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import ScoreboardTeam from './scoreboard-team'

const mapStateToProps = createSelector(
  getTeamById,
  getRosterByTeamId,
  getCurrentLeague,
  (team, roster, league) => ({ team, roster, league })
)

export default connect(
  mapStateToProps
)(ScoreboardTeam)
