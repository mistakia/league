import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_teams_for_current_league } from '@core/selectors'

import DashboardTeamSummaryDivisionOdds from './dashboard-team-summary-division-odds'

const map_state_to_props = createSelector(
  get_app,
  get_teams_for_current_league,
  (app, teams) => {
    const list = teams.toList()
    // Null-tolerant: an undivided league carries null on every team, and
    // `null - null` is 0 rather than NaN, but an explicit floor keeps the
    // comparator honest if one team is ever missing a value the others have.
    const sorted = list.sort(
      (a, b) => (b.division_odds ?? -1) - (a.division_odds ?? -1)
    )
    return { teams: sorted }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryDivisionOdds)
