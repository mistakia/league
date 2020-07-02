import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions, getApp } from '@core/app'

import App from './app'

App.propTypes = {
  children: PropTypes.element
}

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ isPending: app.isPending, authError: app.authError, userId: app.userId })
)

const mapDispatchToProps = {
  init: appActions.init,
  login: appActions.login,
  register: appActions.register
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App)
