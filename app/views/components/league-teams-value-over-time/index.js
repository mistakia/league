import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  get_league_teams_value_deltas
} from '@core/selectors'
import { league_team_daily_values_actions } from '@core/league-team-daily-values'

import LeagueTeamsValueOverTime from './league-teams-value-over-time'

const mapStateToProps = createSelector(
  (state) => state.get('league_team_daily_values'),
  getTeamsForCurrentLeague,
  get_league_teams_value_deltas,
  (league_team_daily_values, teams, teams_value_deltas) => ({
    league_team_daily_values,
    teams,
    teams_value_deltas
  })
)

const mapDispatchToProps = {
  load_league_team_daily_values:
    league_team_daily_values_actions.load_league_team_daily_values
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LeagueTeamsValueOverTime)
