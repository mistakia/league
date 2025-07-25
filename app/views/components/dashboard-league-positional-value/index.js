import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_league,
  get_positions_for_current_league,
  getRosterPositionalValueByTeamId
} from '@core/selectors'

import DashboardLeaguePositionalValue from './dashboard-league-positional-value'

const map_state_to_props = createSelector(
  getRosterPositionalValueByTeamId,
  get_teams_for_current_league,
  get_positions_for_current_league,
  (summary, teams, league_positions) => ({
    summary,
    teams,
    league_positions
  })
)

export default connect(map_state_to_props)(DashboardLeaguePositionalValue)
