import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_teams_for_current_league } from '@core/selectors'

import DashboardTeamSummaryFAAB from './dashboard-team-summary-faab'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  (teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => b.faab - a.faab)
    return { teams: sorted }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryFAAB)
