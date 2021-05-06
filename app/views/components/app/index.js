import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { getPlayers } from '@core/players'

import App from './app'

App.propTypes = {
  children: PropTypes.element
}

const mapStateToProps = createSelector(getApp, getPlayers, (app, players) => ({
  isPending: app.isPending,
  userId: app.userId,
  isInitializing: players.get('isInitializing')
}))

const mapDispatchToProps = {
  init: appActions.init
}

export default connect(mapStateToProps, mapDispatchToProps)(App)
