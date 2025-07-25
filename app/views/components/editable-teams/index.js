import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_current_league,
  get_teams_for_current_league
} from '@core/selectors'
import { team_actions } from '@core/teams'

import EditableTeams from './editable-teams'

const map_state_to_props = createSelector(
  get_app,
  get_current_league,
  get_teams_for_current_league,
  (app, league, teams) => ({
    isCommish: app.userId === league.commishid,
    league,
    teams
  })
)

const map_dispatch_to_props = {
  add: team_actions.add,
  delete: team_actions.delete
}

export default connect(map_state_to_props, map_dispatch_to_props)(EditableTeams)
