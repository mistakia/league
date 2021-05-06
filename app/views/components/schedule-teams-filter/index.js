import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getMatchups } from '@core/matchups'
import { getTeamsForCurrentLeague } from '@core/leagues'

import ScheduleTeamsFilter from './schedule-teams-filter'

const mapStateToProps = createSelector(
  getMatchups,
  getTeamsForCurrentLeague,
  (matchups, leagueTeams) => ({ teams: matchups.get('teams'), leagueTeams })
)

export default connect(mapStateToProps)(ScheduleTeamsFilter)
