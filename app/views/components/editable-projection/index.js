import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { playerActions } from '@core/players'

import EditableProjection from './editable-projection'

const mapStateToProps = createSelector(get_app, (app) => ({
  userId: app.userId
}))

const mapDispatchToProps = {
  save: playerActions.saveProjection
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableProjection)
