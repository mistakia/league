import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_teams_for_current_league } from '@core/selectors'

import DashboardTeamSummaryWaiverOrder from './dashboard-team-summary-waiver-order'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  (teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => a.waiver_order - b.waiver_order)
    return { teams: sorted }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryWaiverOrder)
