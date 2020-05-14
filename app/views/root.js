import React from 'react'
import { Provider } from 'react-redux'
import { BrowserRouter as Router, withRouter } from 'react-router-dom'
import { ConnectedRouter } from 'connected-react-router/immutable'

import createStore from '@core/store'
import history from '@core/history'
import App from '@components/app'

const initialState = window.__INITIAL_STATE__
const store = createStore(initialState, history)

const ConnectedApp = withRouter(App)

const Root = () => (
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <Router>
        <ConnectedApp />
      </Router>
    </ConnectedRouter>
  </Provider>
)

export default Root
