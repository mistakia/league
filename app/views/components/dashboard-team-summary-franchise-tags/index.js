import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryFranchiseTags from './dashboard-team-summary-franchise-tags'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

export default connect(mapStateToProps)(DashboardTeamSummaryFranchiseTags)
