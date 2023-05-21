import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, getTeamsForCurrentLeague } from '@core/selectors'

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
