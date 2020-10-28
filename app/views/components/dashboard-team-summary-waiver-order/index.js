import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getTeamsForCurrentLeague } from '@core/teams'

import DashboardTeamSummaryWaiverOrder from './dashboard-team-summary-waiver-order'

const mapStateToProps = createSelector(
  getApp,
  getTeamsForCurrentLeague,
  (app, teams) => {
    const list = teams.toList()
    const team = list.find(t => t.uid === app.teamId)
    const sorted = list.sort((a, b) => a.wo - b.wo)
    return { teams: sorted, team }
  }
)

export default connect(
  mapStateToProps
)(DashboardTeamSummaryWaiverOrder)
