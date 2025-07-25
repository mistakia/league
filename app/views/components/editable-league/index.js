import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_league_by_id } from '@core/selectors'
import { league_actions } from '@core/leagues'

import EditableLeague from './editable-league'

const map_state_to_props = createSelector(
  get_league_by_id,
  get_app,
  (league, app) => ({ league, userId: app.userId })
)

const map_dispatch_to_props = {
  update: league_actions.update
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(EditableLeague)
