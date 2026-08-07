import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'

import ForgotPasswordPage from './forgot-password'

const map_state_to_props = createSelector(get_app, (app) => ({
  is_updating: app.isUpdating,
  is_password_reset_requested: app.is_password_reset_requested,
  auth_error: app.authError
}))

const map_dispatch_to_props = {
  request_password_reset: app_actions.request_password_reset
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ForgotPasswordPage)
