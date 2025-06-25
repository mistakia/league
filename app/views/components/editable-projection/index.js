import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { player_actions } from '@core/players'

import EditableProjection from './editable-projection'

const mapStateToProps = createSelector(get_app, (app) => ({
  userId: app.userId
}))

const mapDispatchToProps = {
  save: player_actions.save_projection
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableProjection)
