/* global IS_DEV, APP_VERSION */
import React from 'react'
import { Provider } from 'react-redux'
import { HistoryRouter as Router } from 'redux-first-history/rr6'
import Highcharts from 'highcharts'

import Bugsnag from '@bugsnag/js'
import BugsnagPluginReact from '@bugsnag/plugin-react'

import { store, history } from '@core/store.js'
import storeRegistry from '@core/store-registry'
import App from '@components/app'
import ErrorView from '@components/error-view'

storeRegistry.register(store)

Highcharts.setOptions({
  chart: {
    style: {
      fontFamily: "'IBM Plex Mono', monospace"
    }
  }
})

Bugsnag.start({
  apiKey: '183fca706d9f94c00a661167bf8cfc5d',
  autoDetectErrors: !IS_DEV,
  appVersion: APP_VERSION,
  plugins: [new BugsnagPluginReact()],
  enabledReleaseStages: ['production']
})

// Get Bugsnag's ErrorBoundary and configure it with our custom ErrorView
const ErrorBoundary = Bugsnag.getPlugin('react').createErrorBoundary(React)

const Root = () => (
  <ErrorBoundary FallbackComponent={ErrorView}>
    <Provider store={store}>
      <Router history={history}>
        <App />
      </Router>
    </Provider>
  </ErrorBoundary>
)

export default Root
