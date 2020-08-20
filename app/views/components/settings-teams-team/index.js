import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { teamActions, getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'

import SettingsTeamsTeam from './settings-teams-team'

const mapStateToProps = createSelector(
  getApp,
  getTeamById,
  getRosterByTeamId,
  (app, team, roster) => ({ teamId: app.teamId, team, roster })
)

const mapDispatchToProps = {
  delete: teamActions.delete,
  showConfirmation: confirmationActions.show,
  update: teamActions.update
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SettingsTeamsTeam)
