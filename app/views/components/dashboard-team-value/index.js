import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getRosterPositionalValueByTeamId,
  getCurrentLeague
} from '@core/selectors'

import DashboardTeamValue from './dashboard-team-value'

const mapStateToProps = createSelector(
  getRosterPositionalValueByTeamId,
  getCurrentLeague,
  (summary, league) => {
    const quarterOfLeague = Math.ceil(league.num_teams / 4)
    const allValues = Object.values(summary.total).sort((a, b) => b - a)
    const allRank = allValues.indexOf(summary.team_total) + 1

    return { summary, league, quarterOfLeague, allRank }
  }
)

export default connect(mapStateToProps)(DashboardTeamValue)
