import { combineReducers } from 'redux-immutable'
import { connectRouter } from 'connected-react-router'

import { appReducer } from './app'
import { auctionReducer } from './auction'
import { draftReducer } from './draft'
import { leaguesReducer } from './leagues'
import { teamsReducer } from './teams'
import { playersReducer } from './players'
import { rostersReducer } from './rosters'
import { sourcesReducer } from './sources'
import { transactionsReducer } from './transactions'
import { matchupsReducer } from './matchups'
import { tradeReducer } from './trade'
import { statsReducer } from './stats'

const rootReducer = (history) => {
  return combineReducers({
    router: connectRouter(history),
    app: appReducer,
    auction: auctionReducer,
    draft: draftReducer,
    leagues: leaguesReducer,
    teams: teamsReducer,
    players: playersReducer,
    rosters: rostersReducer,
    sources: sourcesReducer,
    transactions: transactionsReducer,
    matchups: matchupsReducer,
    trade: tradeReducer,
    stats: statsReducer
  })
}

export default rootReducer
