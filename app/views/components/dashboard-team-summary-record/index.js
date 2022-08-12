import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getOverallStandings } from '@core/teams'

import DashboardTeamSummaryRecord from './dashboard-team-summary-record'

const mapStateToProps = createSelector(
  getApp,
  getOverallStandings,
  (app, standings) => {
    const overall = standings.divisionLeaders.concat(standings.wildcardTeams)
    return { standings, overall }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryRecord)
