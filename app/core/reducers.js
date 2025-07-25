import { combineReducers } from 'redux-immutable'

import { app_reducer } from './app'
import { auction_reducer } from './auction'
import { draft_reducer } from './draft'
import { leagues_reducer } from './leagues'
import { teams_reducer } from './teams'
import { players_reducer } from './players'
import { rosters_reducer } from './rosters'
import { sources_reducer } from './sources'
import { transactions_reducer } from './transactions'
import { matchups_reducer } from './matchups'
import { trade_reducer } from './trade'
import { stats_reducer } from './stats'
import { context_menu_reducer } from './context-menu'
import { confirmation_reducer } from './confirmations'
import { poaches_reducer } from './poaches'
import { waivers_reducer } from './waivers'
import { schedule_reducer } from './schedule'
import { notification_reducer } from './notifications'
import { status_reducer } from './status'
import { scoreboard_reducer } from './scoreboard'
import { plays_reducer } from './plays'
import { gamelogs_reducer } from './gamelogs'
import { draft_pick_value_reducer } from './draft-pick-value'
import { seasonlogs_reducer } from './seasonlogs'
import { percentiles_reducer } from './percentiles'
import { api_reducer } from './api'
import { league_team_daily_values_reducer } from './league-team-daily-values'
import { data_views_reducer } from './data-views'
import { league_careerlogs_reducer } from './league-careerlogs'
import { data_view_request_reducer } from './data-view-request/reducer'
import { seasons_reducer } from './seasons'

const rootReducer = (router) =>
  combineReducers({
    router,
    app: app_reducer,
    api: api_reducer,
    auction: auction_reducer,
    confirmation: confirmation_reducer,
    contextMenu: context_menu_reducer,
    draft: draft_reducer,
    leagues: leagues_reducer,
    teams: teams_reducer,
    players: players_reducer,
    rosters: rosters_reducer,
    sources: sources_reducer,
    transactions: transactions_reducer,
    matchups: matchups_reducer,
    notification: notification_reducer,
    trade: trade_reducer,
    stats: stats_reducer,
    poaches: poaches_reducer,
    waivers: waivers_reducer,
    schedule: schedule_reducer,
    status: status_reducer,
    scoreboard: scoreboard_reducer,
    plays: plays_reducer,
    gamelogs: gamelogs_reducer,
    draft_pick_value: draft_pick_value_reducer,
    seasonlogs: seasonlogs_reducer,
    percentiles: percentiles_reducer,
    league_team_daily_values: league_team_daily_values_reducer,
    data_views: data_views_reducer,
    league_careerlogs: league_careerlogs_reducer,
    data_view_request: data_view_request_reducer,
    seasons: seasons_reducer
  })

export default rootReducer
