import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getTeamById } from '@core/teams'

import Roster from './roster'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamById,
  (league, team) => ({
    league,
    team
  })
)

export default connect(mapStateToProps)(Roster)
