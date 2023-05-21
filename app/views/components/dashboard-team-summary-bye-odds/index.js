import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryByeOdds from './dashboard-team-summary-bye-odds'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => {
  const list = teams.toList()
  const sorted = list.sort((a, b) => b.bye_odds - a.bye_odds)
  return { teams: sorted }
})

export default connect(mapStateToProps)(DashboardTeamSummaryByeOdds)
