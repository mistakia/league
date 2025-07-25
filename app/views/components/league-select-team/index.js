import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_league,
  get_league_team_historical_ranks,
  get_current_league
} from '@core/selectors'

import LeagueSelectTeam from './league-select-team'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  get_league_team_historical_ranks,
  get_current_league,
  (teams, historical_ranks, league) => ({
    teams,
    historical_ranks,
    league
  })
)

export default connect(map_state_to_props)(LeagueSelectTeam)
