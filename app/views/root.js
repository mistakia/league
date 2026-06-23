import React from 'react'
import { Provider } from 'react-redux'
import { HistoryRouter as Router } from 'redux-first-history/rr6'

import { store, history } from '@core/store.js'
import storeRegistry from '@core/store-registry'
import { ErrorBoundary, init_error_reporting } from '@core/bugsnag'
import App from '@components/app'
import ErrorView from '@components/error-view'

storeRegistry.register(store)

// Install global error/rejection handlers. The ErrorBoundary additionally
// captures React render errors synchronously and reports to /api/errors.
init_error_reporting()

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
