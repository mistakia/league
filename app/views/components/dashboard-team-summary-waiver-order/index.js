import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryWaiverOrder from './dashboard-team-summary-waiver-order'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => {
  const list = teams.toList()
  const sorted = list.sort((a, b) => a.waiver_order - b.waiver_order)
  return { teams: sorted }
})

export default connect(mapStateToProps)(DashboardTeamSummaryWaiverOrder)
