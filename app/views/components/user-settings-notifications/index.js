import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { setting_actions } from '@core/settings/actions'

import UserSettingsNotifications from './user-settings-notifications'

const map_state_to_props = createSelector(get_app, (app) => ({
  user: app.user
}))

const map_dispatch_to_props = {
  update: setting_actions.update
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(UserSettingsNotifications)
