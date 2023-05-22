import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getMatchups, getTeamsForCurrentLeague } from '@core/selectors'

import ScheduleTeamsFilter from './schedule-teams-filter'

const mapStateToProps = createSelector(
  getMatchups,
  getTeamsForCurrentLeague,
  (matchups, teams) => ({
    matchup_teams: matchups.get('teams'),
    league_teams: teams.toList()
  })
)

export default connect(mapStateToProps)(ScheduleTeamsFilter)
