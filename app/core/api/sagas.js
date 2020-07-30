import { race, call, put, take, cancelled, select } from 'redux-saga/effects'
import { api, apiRequest } from '@core/api/service'
import { LOCATION_CHANGE } from 'connected-react-router'

import {
  authActions,
  loginActions,
  registerActions,
  getApp
} from '@core/app'

import { getDraftActions, postDraftActions } from '@core/draft'
import {
  getRosterActions,
  getRostersActions,
  putRosterActions,
  postActivateActions,
  postDeactivateActions
} from '@core/rosters'
import {
  playersRequestActions,
  getPlayerStatsActions,
  putProjectionActions,
  delProjectionActions
} from '@core/players'
import { getPlaysActions, getTeamStatActions } from '@core/stats'
import { getTeamsActions, putTeamActions } from '@core/teams'
import { getTransactionsActions } from '@core/transactions'
import { getMatchupsActions, postMatchupsActions } from '@core/matchups'
import {
  postTradeProposeActions,
  postTradeAcceptActions,
  postTradeCancelActions,
  postTradeRejectActions,
  getTradesActions
} from '@core/trade'
import { putLeagueActions } from '@core/leagues'
import { getSourcesActions, putSourceActions } from '@core/sources'
import { putSettingActions, putBaselinesActions } from '@core/settings'

function * fetchAPI (apiFunction, actions, opts = {}) {
  const { token } = yield select(getApp)
  const { abort, request } = apiRequest(apiFunction, opts, token)
  try {
    yield put(actions.pending(opts))
    const data = yield call(request)
    yield put(actions.fulfilled(opts, data))
  } catch (err) {
    console.log(err)
    yield put(actions.failed(opts, err.toString()))
  } finally {
    if (yield cancelled()) {
      abort()
    }
  }
}

function * fetch (...args) {
  yield race([
    call(fetchAPI.bind(null, ...args)),
    take(LOCATION_CHANGE)
  ])
}

export const postRegister = fetch.bind(null, api.postRegister, registerActions)
export const postLogin = fetch.bind(null, api.postLogin, loginActions)
export const fetchAuth = fetch.bind(null, api.fetchAuth, authActions)

export const fetchPlayers = fetch.bind(null, api.fetchPlayers, playersRequestActions)
export const getPlayerStats = fetch.bind(null, api.getPlayerStats, getPlayerStatsActions)
export const getPlays = fetch.bind(null, api.getPlays, getPlaysActions)

export const getRoster = fetch.bind(null, api.getRoster, getRosterActions)
export const getRosters = fetch.bind(null, api.getRosters, getRostersActions)
export const putRoster = fetch.bind(null, api.putRoster, putRosterActions)
export const postActivate = fetch.bind(null, api.postActivate, postActivateActions)
export const postDeactivate = fetch.bind(null, api.postDeactivate, postDeactivateActions)

export const fetchDraft = fetch.bind(null, api.getDraft, getDraftActions)
export const postDraft = fetch.bind(null, api.postDraft, postDraftActions)

export const getTeams = fetch.bind(null, api.getTeams, getTeamsActions)
export const fetchTransactions = fetch.bind(null, api.getTransactions, getTransactionsActions)

export const getMatchups = fetch.bind(null, api.getMatchups, getMatchupsActions)
export const postMatchups = fetch.bind(null, api.postMatchups, postMatchupsActions)

export const postProposeTrade = fetch.bind(null, api.postProposeTrade, postTradeProposeActions)
export const getTrades = fetch.bind(null, api.getTrades, getTradesActions)

export const postCancelTrade = fetch.bind(null, api.postCancelTrade, postTradeCancelActions)
export const postAcceptTrade = fetch.bind(null, api.postAcceptTrade, postTradeAcceptActions)
export const postRejectTrade = fetch.bind(null, api.postRejectTrade, postTradeRejectActions)

export const putLeague = fetch.bind(null, api.putLeague, putLeagueActions)

export const putTeam = fetch.bind(null, api.putTeam, putTeamActions)

export const getSources = fetch.bind(null, api.getSources, getSourcesActions)
export const putSource = fetch.bind(null, api.putSource, putSourceActions)

export const putProjection = fetch.bind(null, api.putProjection, putProjectionActions)
export const delProjection = fetch.bind(null, api.delProjection, delProjectionActions)

export const putSetting = fetch.bind(null, api.putSetting, putSettingActions)
export const putBaselines = fetch.bind(null, api.putBaselines, putBaselinesActions)

export const getTeamStats = fetch.bind(null, api.getTeamStats, getTeamStatActions)
