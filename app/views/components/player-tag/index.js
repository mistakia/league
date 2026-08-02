import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'

import PlayerTag from './player-tag'

const map_state_to_props = createSelector(get_app, (app) => ({
  my_team_id: app.teamId
}))

export default connect(map_state_to_props)(PlayerTag)
