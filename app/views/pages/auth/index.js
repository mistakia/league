import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'

import AuthPage from './auth'

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ isPending: app.isPending, authError: app.authError })
)

const mapDispatchToProps = {
  login: appActions.login,
  register: appActions.register
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuthPage)
