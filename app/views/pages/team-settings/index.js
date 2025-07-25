import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'

import TeamSettingsPage from './team-settings'

const map_state_to_props = createSelector(get_app, (app) => ({
  teamId: app.teamId
}))

export default connect(map_state_to_props)(TeamSettingsPage)
