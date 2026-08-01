import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_current_league,
  get_teams_for_current_league
} from '@core/selectors'

import RestrictedFreeAgencySchedule from './restricted-free-agency-schedule'

const map_state_to_props = createSelector(
  get_current_league,
  get_teams_for_current_league,
  get_app,
  (league, teams, app) => ({ league, teams, team_id: app.teamId })
)

export default connect(map_state_to_props)(RestrictedFreeAgencySchedule)
