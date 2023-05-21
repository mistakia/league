import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  getCurrentLeague,
  getRosterPositionalValueByTeamId
} from '@core/selectors'

import DashboardLeaguePositionalValue from './dashboard-league-positional-value'

const mapStateToProps = createSelector(
  getRosterPositionalValueByTeamId,
  getTeamsForCurrentLeague,
  getCurrentLeague,
  (summary, teams, league) => ({ summary, teams, league })
)

export default connect(mapStateToProps)(DashboardLeaguePositionalValue)
