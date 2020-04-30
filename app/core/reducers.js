import { combineReducers } from 'redux-immutable'
import { connectRouter } from 'connected-react-router'

import { appReducer } from './app'

const rootReducer = (history) => {
  return combineReducers({
    router: connectRouter(history),
    app: appReducer,
  })
}

export default rootReducer
