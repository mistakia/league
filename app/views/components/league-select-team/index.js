import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  get_league_team_historical_ranks
} from '@core/selectors'

import LeagueSelectTeam from './league-select-team'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  get_league_team_historical_ranks,
  (teams, historical_ranks) => ({
    teams,
    historical_ranks
  })
)

export default connect(mapStateToProps)(LeagueSelectTeam)
