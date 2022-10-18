import { combineReducers } from 'redux-immutable'

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
import { contextMenuReducer } from './context-menu'
import { confirmationReducer } from './confirmations'
import { poachesReducer } from './poaches'
import { waiversReducer } from './waivers'
import { scheduleReducer } from './schedule'
import { notificationReducer } from './notifications'
import { statusReducer } from './status'
import { scoreboardReducer } from './scoreboard'
import { playsReducer } from './plays'
import { gamelogsReducer } from './gamelogs'
import { propsReducer } from './props'
import { draftPickValueReducer } from './draft-pick-value'
import { seasonlogsReducer } from './seasonlogs'
import { percentilesReducer } from './percentiles'
import { apiReducer } from './api'

const rootReducer = (router) =>
  combineReducers({
    router,
    app: appReducer,
    api: apiReducer,
    auction: auctionReducer,
    confirmation: confirmationReducer,
    contextMenu: contextMenuReducer,
    draft: draftReducer,
    leagues: leaguesReducer,
    teams: teamsReducer,
    players: playersReducer,
    rosters: rostersReducer,
    sources: sourcesReducer,
    transactions: transactionsReducer,
    matchups: matchupsReducer,
    notification: notificationReducer,
    trade: tradeReducer,
    stats: statsReducer,
    poaches: poachesReducer,
    waivers: waiversReducer,
    schedule: scheduleReducer,
    status: statusReducer,
    scoreboard: scoreboardReducer,
    plays: playsReducer,
    gamelogs: gamelogsReducer,
    props: propsReducer,
    draft_pick_value: draftPickValueReducer,
    seasonlogs: seasonlogsReducer,
    percentiles: percentilesReducer
  })

export default rootReducer
