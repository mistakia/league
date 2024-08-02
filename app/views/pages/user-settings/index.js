import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { settingActions } from '@core/settings'

import UserSettingsPage from './user-settings'

const map_state_to_props = createSelector(get_app, (app) => ({
  user: app.user
}))

const mapDispatchToProps = {
  update: settingActions.update
}

export default connect(map_state_to_props, mapDispatchToProps)(UserSettingsPage)
