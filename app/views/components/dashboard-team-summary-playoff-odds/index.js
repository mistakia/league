import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getTeamsForCurrentLeague } from '@core/teams'

import DashboardTeamSummaryPlayoffOdds from './dashboard-team-summary-playoff-odds'

const mapStateToProps = createSelector(
  getApp,
  getTeamsForCurrentLeague,
  (app, teams) => {
    const list = teams.toList()
    const team = list.find((t) => t.uid === app.teamId)
    const sorted = list.sort((a, b) => b.playoff_odds - a.playoff_odds)
    const rank = sorted.findIndex((t) => t.uid === app.teamId) + 1
    return { teams: sorted, team, rank }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryPlayoffOdds)
