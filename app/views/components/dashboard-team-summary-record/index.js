import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_overall_standings } from '@core/selectors'

import DashboardTeamSummaryRecord from './dashboard-team-summary-record'

const map_state_to_props = createSelector(
  get_app,
  get_overall_standings,
  (app, standings) => {
    const overall = standings.divisionLeaders.concat(standings.wildcardTeams)
    return { standings, overall }
  }
)

export default connect(map_state_to_props)(DashboardTeamSummaryRecord)
