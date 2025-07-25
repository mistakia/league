import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_league } from '@core/selectors'

import DashboardTeamSummaryFranchiseTags from './dashboard-team-summary-franchise-tags'

const map_state_to_props = createSelector(get_current_league, (league) => ({
  league
}))

export default connect(map_state_to_props)(DashboardTeamSummaryFranchiseTags)
