import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions, getApp, getUserId } from '@core/app'

import App from './app'

App.propTypes = {
  children: PropTypes.element
}

const mapStateToProps = createSelector(
  getApp,
  getUserId,
  (app, userId) => ({ isPending: app.isPending, authError: app.authError, userId })
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
