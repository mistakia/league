import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_team_by_id_for_current_year,
  getRosterByTeamId
} from '@core/selectors'
import { teamActions } from '@core/teams'
import { confirmationActions } from '@core/confirmations'

import SettingsTeamsTeam from './settings-teams-team'

const mapStateToProps = createSelector(
  get_app,
  get_team_by_id_for_current_year,
  getRosterByTeamId,
  (app, team, roster) => ({ teamId: app.teamId, team, roster })
)

const mapDispatchToProps = {
  delete: teamActions.delete,
  showConfirmation: confirmationActions.show,
  update: teamActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsTeamsTeam)
