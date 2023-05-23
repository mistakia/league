import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_team_value_deltas_by_team_id } from '@core/selectors'
import { league_team_daily_values_actions } from '@core/league-team-daily-values'

import LeagueTeamValueDeltas from './league-team-value-deltas'

const mapStateToProps = createSelector(
  get_team_value_deltas_by_team_id,
  (team_value_deltas) => ({ team_value_deltas })
)

const mapDispatchToProps = {
  load_league_team_daily_values:
    league_team_daily_values_actions.load_league_team_daily_values
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LeagueTeamValueDeltas)
