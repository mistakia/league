import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_matchups_state,
  get_teams_for_current_league
} from '@core/selectors'

import ScheduleTeamsFilter from './schedule-teams-filter'

const map_state_to_props = createSelector(
  get_matchups_state,
  get_teams_for_current_league,
  (matchups, teams) => ({
    matchup_teams: matchups.get('teams'),
    league_teams: teams.toList()
  })
)

export default connect(map_state_to_props)(ScheduleTeamsFilter)
