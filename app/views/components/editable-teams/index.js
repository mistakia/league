import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague, teamActions } from '@core/teams'

import EditableTeams from './editable-teams'

const mapStateToProps = createSelector(
  getApp,
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (app, league, teams) => ({
    isCommish: app.userId === league.commishid,
    league,
    teams
  })
)

const mapDispatchToProps = {
  add: teamActions.add,
  delete: teamActions.delete
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableTeams)
