import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getOverallStandings } from '@core/selectors'

import DashboardTeamSummaryRecord from './dashboard-team-summary-record'

const mapStateToProps = createSelector(
  get_app,
  getOverallStandings,
  (app, standings) => {
    const overall = standings.divisionLeaders.concat(standings.wildcardTeams)
    return { standings, overall }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryRecord)
