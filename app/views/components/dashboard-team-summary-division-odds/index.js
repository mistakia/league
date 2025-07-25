import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_teams_for_current_league } from '@core/selectors'

import DashboardTeamSummaryDivisionOdds from './dashboard-team-summary-division-odds'

const map_state_to_props = createSelector(
  get_app,
  get_teams_for_current_league,
  (app, teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => b.division_odds - a.division_odds)
    return { teams: sorted }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryDivisionOdds)
