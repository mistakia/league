import { combineReducers } from 'redux-immutable'
import { connectRouter } from 'connected-react-router'

import { appReducer } from './app'
import { draftReducer } from './draft'
import { leaguesReducer } from './leagues'
import { teamsReducer } from './teams'
import { playersReducer } from './players'
import { rostersReducer } from './rosters'

const rootReducer = (history) => {
  return combineReducers({
    router: connectRouter(history),
    app: appReducer,
    draft: draftReducer,
    leagues: leaguesReducer,
    teams: teamsReducer,
    players: playersReducer,
    rosters: rostersReducer
  })
}

export default rootReducer
