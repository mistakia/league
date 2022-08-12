import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/teams'

import DashboardTeamSummaryWaiverOrder from './dashboard-team-summary-waiver-order'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => {
  const list = teams.toList()
  const sorted = list.sort((a, b) => a.wo - b.wo)
  return { teams: sorted }
})

export default connect(mapStateToProps)(DashboardTeamSummaryWaiverOrder)
