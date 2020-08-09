import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById, teamActions } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'

import EditableTeam from './editable-team'

const mapStateToProps = createSelector(
  getTeamById,
  getCurrentLeague,
  (team, league) => ({ team, isHosted: !!league.hosted })
)

const mapDispatchToProps = {
  update: teamActions.update
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditableTeam)
