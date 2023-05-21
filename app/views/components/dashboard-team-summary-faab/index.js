import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryFAAB from './dashboard-team-summary-faab'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => {
  const list = teams.toList()
  const sorted = list.sort((a, b) => b.faab - a.faab)
  return { teams: sorted }
})

export default connect(mapStateToProps)(DashboardTeamSummaryFAAB)
