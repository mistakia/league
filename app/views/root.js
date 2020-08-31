/* global IS_DEV, APP_VERSION */
import React from 'react'
import { Provider } from 'react-redux'
import { BrowserRouter as Router, withRouter } from 'react-router-dom'
import { ConnectedRouter } from 'connected-react-router/immutable'
import Bugsnag from '@bugsnag/js'
import BugsnagPluginReact from '@bugsnag/plugin-react'

import createStore from '@core/store'
import history from '@core/history'
import App from '@components/app'

Bugsnag.start({
  apiKey: '183fca706d9f94c00a661167bf8cfc5d',
  autoDetectErrors: !IS_DEV,
  appVersion: APP_VERSION,
  plugins: [new BugsnagPluginReact()]
})

const initialState = window.__INITIAL_STATE__
const store = createStore(initialState, history)

const ConnectedApp = withRouter(App)
const ErrorBoundary = Bugsnag.getPlugin('react')
  .createErrorBoundary(React)

const Root = () => (
  <ErrorBoundary>
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <Router>
          <ConnectedApp />
        </Router>
      </ConnectedRouter>
    </Provider>
  </ErrorBoundary>
)

export default Root
