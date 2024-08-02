import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app } from '@core/selectors'
import { settingActions } from '@core/settings/actions'

import UserSettingsNotifications from './user-settings-notifications'

const mapStateToProps = createSelector(get_app, (app) => ({
  user: app.user
}))

const mapDispatchToProps = {
  update: settingActions.update
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserSettingsNotifications)
