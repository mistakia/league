import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  get_league_team_historical_ranks,
  getCurrentLeague
} from '@core/selectors'

import LeagueSelectTeam from './league-select-team'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  get_league_team_historical_ranks,
  getCurrentLeague,
  (teams, historical_ranks, league) => ({
    teams,
    historical_ranks,
    league
  })
)

export default connect(mapStateToProps)(LeagueSelectTeam)
