import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_teams_for_current_league } from '@core/selectors'

import DashboardTeamSummaryPlayoffOdds from './dashboard-team-summary-playoff-odds'

const map_state_to_props = createSelector(
  get_app,
  get_teams_for_current_league,
  (app, teams) => {
    const list = teams.toList()
    const sorted = list.sort((a, b) => b.playoff_odds - a.playoff_odds)
    return { teams: sorted }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryPlayoffOdds)
