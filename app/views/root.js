import React from 'react'
import { Provider } from 'react-redux'
import { HistoryRouter as Router } from 'redux-first-history/rr6'

import { store, history } from '@core/store.js'
import storeRegistry from '@core/store-registry'
import { ErrorBoundary, init_bugsnag } from '@core/bugsnag'
import App from '@components/app'
import ErrorView from '@components/error-view'

storeRegistry.register(store)

// Defer Bugsnag SDK off the critical path. The local ErrorBoundary captures
// boundary errors synchronously and dual-writes to /api/errors regardless.
init_bugsnag()

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
