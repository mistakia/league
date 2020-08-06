import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { errorActions } from '@core/errors'

import App from './app'

App.propTypes = {
  children: PropTypes.element
}

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ isPending: app.isPending, userId: app.userId })
)

const mapDispatchToProps = {
  init: appActions.init,
  report: errorActions.report
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App)
