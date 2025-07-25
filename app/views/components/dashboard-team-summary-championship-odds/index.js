import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_teams_for_current_league } from '@core/selectors'

import DashboardTeamSummaryChampionshipOdds from './dashboard-team-summary-championship-odds'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  (teams) => {
    const list = teams.toList()
    const sorted = list.sort(
      (a, b) => b.championship_odds - a.championship_odds
    )
    return { teams: sorted }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryChampionshipOdds)
