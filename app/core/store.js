import { fromJS } from 'immutable'
import { applyMiddleware, compose, createStore } from 'redux'
import { routerMiddleware } from 'connected-react-router/immutable'
import createSagaMiddleware, { END } from 'redux-saga'

import rootSaga from './sagas'
import rootReducer from './reducers'

const sagaMiddleware = createSagaMiddleware()

let store = null

export default (initialState = {}, history) => {
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

  // ======================================================
  // Middleware Configuration
  // ======================================================
  const middlewares = [
    sagaMiddleware,
    routerMiddleware(history)
  ]

  // ======================================================
  // Store Enhancers
  // ======================================================
  const enhancers = [
    applyMiddleware(...middlewares)
  ]

  // ======================================================
  // Store Instantiation and HMR Setup
  // ======================================================
  store = createStore(
    rootReducer(history),
    fromJS(initialState),
    composeEnhancers(...enhancers)
  )

  sagaMiddleware.run(rootSaga)
  store.asyncReducers = {}
  store.close = () => store.dispatch(END)

  if (module.hot) {
    // Enable webpack hot module replacement for reducers
    module.hot.accept('./reducers', () => {
      const createReducers = require('./reducers').default
      const nextReducers = createReducers(store.asyncReducers)
      store.replaceReducer(nextReducers)
    })
  }

  return store
}

export { store }
