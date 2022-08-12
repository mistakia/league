import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague } from '@core/teams'

import LeagueSelectTeam from './league-select-team'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (league, teams) => ({
    league,
    teams
  })
)

export default connect(mapStateToProps)(LeagueSelectTeam)
