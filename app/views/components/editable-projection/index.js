import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { player_actions } from '@core/players'

import EditableProjection from './editable-projection'

const map_state_to_props = createSelector(get_app, (app) => ({
  userId: app.userId
}))

const map_dispatch_to_props = {
  save: player_actions.save_projection
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(EditableProjection)
