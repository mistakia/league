import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getTeamsForCurrentLeague } from '@core/teams'

import DashboardTeamSummaryRecord from './dashboard-team-summary-record'

const mapStateToProps = createSelector(
  getApp,
  getTeamsForCurrentLeague,
  (app, teams) => {
    const list = teams.toList()
    const team = list.find(t => t.uid === app.teamId)
    const sorted = list.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
    const rank = sorted.findIndex(t => t.uid === app.teamId) + 1
    return { teams: sorted, team, rank }
  }
)

export default connect(
  mapStateToProps
)(DashboardTeamSummaryRecord)
