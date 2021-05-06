import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentTeamRosterPositionalValue } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague } from '@core/teams'

import DashboardLeaguePositionalValue from './dashboard-league-positional-value'

const mapStateToProps = createSelector(
  getCurrentTeamRosterPositionalValue,
  getTeamsForCurrentLeague,
  getCurrentLeague,
  (summary, teams, league) => ({ summary, teams, league })
)

export default connect(mapStateToProps)(DashboardLeaguePositionalValue)
