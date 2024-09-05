import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  get_positions_for_current_league,
  getRosterPositionalValueByTeamId
} from '@core/selectors'

import DashboardLeaguePositionalValue from './dashboard-league-positional-value'

const mapStateToProps = createSelector(
  getRosterPositionalValueByTeamId,
  getTeamsForCurrentLeague,
  get_positions_for_current_league,
  (summary, teams, league_positions) => ({
    summary,
    teams,
    league_positions
  })
)

export default connect(mapStateToProps)(DashboardLeaguePositionalValue)
