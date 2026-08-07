import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'

import ResetPasswordPage from './reset-password'

const map_state_to_props = createSelector(get_app, (app) => ({
  is_updating: app.isUpdating,
  is_password_reset: app.is_password_reset,
  auth_error: app.authError
}))

const map_dispatch_to_props = {
  reset_password: app_actions.reset_password
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ResetPasswordPage)
