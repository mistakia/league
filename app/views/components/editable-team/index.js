import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById, teamActions } from '@core/teams'

import EditableTeam from './editable-team'

const mapStateToProps = createSelector(
  getTeamById,
  (team) => ({ team })
)

const mapDispatchToProps = {
  update: teamActions.update
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditableTeam)
