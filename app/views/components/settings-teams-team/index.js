import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getTeamById, getRosterByTeamId } from '@core/selectors'
import { teamActions } from '@core/teams'
import { confirmationActions } from '@core/confirmations'

import SettingsTeamsTeam from './settings-teams-team'

const mapStateToProps = createSelector(
  get_app,
  getTeamById,
  getRosterByTeamId,
  (app, team, roster) => ({ teamId: app.teamId, team, roster })
)

const mapDispatchToProps = {
  delete: teamActions.delete,
  showConfirmation: confirmationActions.show,
  update: teamActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsTeamsTeam)
