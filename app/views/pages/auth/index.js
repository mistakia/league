import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app } from '@core/selectors'

import AuthPage from './auth'

const mapStateToProps = createSelector(get_app, (app) => ({
  isPending: app.isPending,
  authError: app.authError
}))

const mapDispatchToProps = {
  login: appActions.login,
  register: appActions.register
}

export default connect(mapStateToProps, mapDispatchToProps)(AuthPage)
