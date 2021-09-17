import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getOverallStandings } from '@core/teams'

import DashboardTeamSummaryRecord from './dashboard-team-summary-record'

const mapStateToProps = createSelector(
  getApp,
  getOverallStandings,
  (app, standings) => {
    const team = standings.teams.find((t) => t.uid === app.teamId)
    const overall = standings.divisionLeaders.concat(standings.wildcardTeams)
    const rank = overall.findIndex((t) => t.uid === app.teamId) + 1
    return { standings, overall, team, rank }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryRecord)
