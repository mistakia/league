import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getTeamsForCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryPlayoffOdds from './dashboard-team-summary-playoff-odds'

const mapStateToProps = createSelector(
  get_app,
  getTeamsForCurrentLeague,
  (app, teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => b.playoff_odds - a.playoff_odds)
    return { teams: sorted }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummaryPlayoffOdds)
