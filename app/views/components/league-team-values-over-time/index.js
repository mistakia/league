import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'
import { league_team_daily_values_actions } from '@core/league-team-daily-values'

import LeagueTeamValuesOverTime from './league-team-values-over-time'

const mapStateToProps = createSelector(
  (state) => state.get('league_team_daily_values'),
  getTeamsForCurrentLeague,
  (league_team_daily_values, teams) => ({ league_team_daily_values, teams })
)

const mapDispatchToProps = {
  load_league_team_daily_values:
    league_team_daily_values_actions.load_league_team_daily_values
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LeagueTeamValuesOverTime)
