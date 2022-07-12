import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getTeamById } from '@core/teams'
import { getApp } from '@core/app'

import Roster from './roster'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamById,
  getApp,
  (league, team, app) => ({
    league,
    team,
    teamId: app.teamId
  })
)

export default connect(mapStateToProps)(Roster)
