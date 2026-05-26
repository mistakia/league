import { fromJS } from 'immutable'
import { applyMiddleware, compose, createStore } from 'redux'
import { createReduxHistoryContext } from 'redux-first-history'
import createSagaMiddleware, { END } from 'redux-saga'
import { createBrowserHistory, createHashHistory } from 'history'

import rootSaga from './sagas'
import rootReducer from './reducers'

const sagaMiddleware = createSagaMiddleware()
const initialState = window.__INITIAL_STATE__

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

const { createReduxHistory, routerMiddleware, routerReducer } =
  createReduxHistoryContext({
    history:
      'standalone' in window.navigator && window.navigator.standalone
        ? createHashHistory()
        : createBrowserHistory(),
    selectRouterState: (state) => state.get('router')
  })

const middlewares = [sagaMiddleware, routerMiddleware]
const enhancers = [applyMiddleware(...middlewares)]

const dynamic_reducers = {}
const injected_saga_keys = new Set()

const build_reducer = () =>
  rootReducer(routerReducer, dynamic_reducers)

export const store = createStore(
  build_reducer(),
  fromJS(initialState),
  composeEnhancers(...enhancers)
)

sagaMiddleware.run(rootSaga)
store.close = () => store.dispatch(END)

if (module.hot) {
  module.hot.accept('./reducers', () => {
    store.replaceReducer(build_reducer())
  })
}

export const history = createReduxHistory(store)

/**
 * Register a reducer at runtime. Lazy-route modules call this at top level
 * so their slice exists before the route renders.
 */
export const inject_reducer = (key, reducer) => {
  if (dynamic_reducers[key]) return
  dynamic_reducers[key] = reducer
  store.replaceReducer(build_reducer())
}

/**
 * Register a saga at runtime. `key` makes injection idempotent across
 * remounts and hot reloads.
 */
export const inject_saga = (key, saga) => {
  if (injected_saga_keys.has(key)) return
  injected_saga_keys.add(key)
  sagaMiddleware.run(saga)
}
