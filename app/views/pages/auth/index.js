import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'

import AuthPage from './auth'

// These keys must match what auth.js destructures. They read `isPending` /
// `authError` here until 2026-08-07 while the page destructured `is_pending` /
// `auth_error`, so the login page rendered no error text and no loading state
// — an absent prop is silently valid, so nothing warned.
const map_state_to_props = createSelector(get_app, (app) => ({
  is_pending: app.isPending,
  is_updating: app.isUpdating,
  auth_error: app.authError
}))

const map_dispatch_to_props = {
  login: app_actions.login,
  register: app_actions.register
}

export default connect(map_state_to_props, map_dispatch_to_props)(AuthPage)
