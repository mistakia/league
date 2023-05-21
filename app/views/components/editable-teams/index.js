import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  getCurrentLeague,
  getTeamsForCurrentLeague
} from '@core/selectors'
import { teamActions } from '@core/teams'

import EditableTeams from './editable-teams'

const mapStateToProps = createSelector(
  get_app,
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
