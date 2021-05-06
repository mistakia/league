import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { playerActions } from '@core/players'

import EditableProjection from './editable-projection'

const mapStateToProps = createSelector(getApp, (app) => ({
  userId: app.userId
}))

const mapDispatchToProps = {
  save: playerActions.saveProjection
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableProjection)
