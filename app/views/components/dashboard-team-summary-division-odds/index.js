import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getTeamsForCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryDivisionOdds from './dashboard-team-summary-division-odds'

const mapStateToProps = createSelector(
  get_app,
  getTeamsForCurrentLeague,
  (app, teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => b.division_odds - a.division_odds)
    return { teams: sorted }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryDivisionOdds)
