import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getTeamsForCurrentLeague } from '@core/teams'

import DashboardTeamSummaryDivisionOdds from './dashboard-team-summary-division-odds'

const mapStateToProps = createSelector(
  getApp,
  getTeamsForCurrentLeague,
  (app, teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => b.division_odds - a.division_odds)
    return { teams: sorted }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryDivisionOdds)
