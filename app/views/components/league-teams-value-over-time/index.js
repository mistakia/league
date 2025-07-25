import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_league,
  get_league_teams_value_deltas
} from '@core/selectors'
import { league_team_daily_values_actions } from '@core/league-team-daily-values'

import LeagueTeamsValueOverTime from './league-teams-value-over-time'

const map_state_to_props = createSelector(
  (state) => state.get('league_team_daily_values'),
  get_teams_for_current_league,
  get_league_teams_value_deltas,
  (league_team_daily_values, teams, teams_value_deltas) => ({
    league_team_daily_values,
    teams,
    teams_value_deltas
  })
)

const map_dispatch_to_props = {
  load_league_team_daily_values:
    league_team_daily_values_actions.load_league_team_daily_values
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(LeagueTeamsValueOverTime)
