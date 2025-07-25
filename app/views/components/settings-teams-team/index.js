import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_team_by_id_for_current_year,
  getRosterByTeamId
} from '@core/selectors'
import { team_actions } from '@core/teams'
import { confirmation_actions } from '@core/confirmations'

import SettingsTeamsTeam from './settings-teams-team'

const map_state_to_props = createSelector(
  get_app,
  get_team_by_id_for_current_year,
  getRosterByTeamId,
  (app, team, roster) => ({ teamId: app.teamId, team, roster })
)

const map_dispatch_to_props = {
  delete: team_actions.delete,
  showConfirmation: confirmation_actions.show,
  update: team_actions.update
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SettingsTeamsTeam)
