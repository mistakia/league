import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'

import AuthPage from './auth'

const map_state_to_props = createSelector(get_app, (app) => ({
  isPending: app.isPending,
  authError: app.authError
}))

const map_dispatch_to_props = {
  login: app_actions.login,
  register: app_actions.register
}

export default connect(map_state_to_props, map_dispatch_to_props)(AuthPage)
