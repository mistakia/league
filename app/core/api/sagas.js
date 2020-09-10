import { race, call, put, take, cancelled, select } from 'redux-saga/effects'
import Bugsnag from '@bugsnag/js'
import { LOCATION_CHANGE } from 'connected-react-router'

import { api, apiRequest } from '@core/api/service'
import {
  authActions,
  loginActions,
  registerActions,
  getApp
} from '@core/app'

import { getStatusActions } from '@core/status'
import { getScheduleActions } from '@core/schedule'
import { getDraftActions, postDraftActions } from '@core/draft'
import {
  getRosterActions,
  getRostersActions,
  putRosterActions,
  postActivateActions,
  postDeactivateActions,
  postRostersActions,
  putRostersActions,
  deleteRostersActions,
  postAddFreeAgentActions,
  postReserveActions,
  postReleaseActions
} from '@core/rosters'
import {
  playersRequestActions,
  getPlayerStatsActions,
  putProjectionActions,
  delProjectionActions
} from '@core/players'
import { getPlaysActions, getTeamStatActions } from '@core/stats'
import {
  getTeamsActions,
  putTeamActions,
  postTeamsActions,
  deleteTeamsActions
} from '@core/teams'
import { getTransactionsActions, getReleaseTransactionsActions } from '@core/transactions'
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
import { postPoachActions } from '@core/poaches'
import {
  postWaiverActions,
  postCancelWaiverActions,
  postWaiverOrderActions,
  getWaiversActions,
  getWaiverReportActions
} from '@core/waivers'
import { notificationActions } from '@core/notifications'
import { postErrorActions } from '@core/errors'

function * fetchAPI (apiFunction, actions, opts = {}) {
  const { token } = yield select(getApp)
  const { abort, request } = apiRequest(apiFunction, opts, token)
  try {
    yield put(actions.pending(opts))
    const data = yield call(request)
    yield put(actions.fulfilled(opts, data))
  } catch (err) {
    if (!opts.ignoreError) {
      yield put(notificationActions.show({ severity: 'error', message: err.message }))
      Bugsnag.notify(err, (event) => {
        event.addMetadata('options', opts)
      })
    }
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

export const postRosters = fetch.bind(null, api.postRosters, postRostersActions)
export const putRosters = fetch.bind(null, api.putRosters, putRostersActions)
export const deleteRosters = fetch.bind(null, api.deleteRosters, deleteRostersActions)

export const postAddFreeAgent = fetch.bind(null, api.postAddFreeAgent, postAddFreeAgentActions)
export const postRelease = fetch.bind(null, api.postRelease, postReleaseActions)

export const postActivate = fetch.bind(null, api.postActivate, postActivateActions)
export const postDeactivate = fetch.bind(null, api.postDeactivate, postDeactivateActions)
export const postReserve = fetch.bind(null, api.postReserve, postReserveActions)

export const fetchDraft = fetch.bind(null, api.getDraft, getDraftActions)
export const postDraft = fetch.bind(null, api.postDraft, postDraftActions)

export const getTeams = fetch.bind(null, api.getTeams, getTeamsActions)
export const fetchTransactions = fetch.bind(null, api.getTransactions, getTransactionsActions)
export const getReleaseTransactions = fetch.bind(null, api.getReleaseTransactions, getReleaseTransactionsActions)

export const getMatchups = fetch.bind(null, api.getMatchups, getMatchupsActions)
export const postMatchups = fetch.bind(null, api.postMatchups, postMatchupsActions)

export const postProposeTrade = fetch.bind(null, api.postProposeTrade, postTradeProposeActions)
export const getTrades = fetch.bind(null, api.getTrades, getTradesActions)

export const postCancelTrade = fetch.bind(null, api.postCancelTrade, postTradeCancelActions)
export const postAcceptTrade = fetch.bind(null, api.postAcceptTrade, postTradeAcceptActions)
export const postRejectTrade = fetch.bind(null, api.postRejectTrade, postTradeRejectActions)

export const putLeague = fetch.bind(null, api.putLeague, putLeagueActions)

export const putTeam = fetch.bind(null, api.putTeam, putTeamActions)
export const postTeams = fetch.bind(null, api.postTeams, postTeamsActions)
export const deleteTeams = fetch.bind(null, api.deleteTeams, deleteTeamsActions)

export const getSources = fetch.bind(null, api.getSources, getSourcesActions)
export const putSource = fetch.bind(null, api.putSource, putSourceActions)

export const putProjection = fetch.bind(null, api.putProjection, putProjectionActions)
export const delProjection = fetch.bind(null, api.delProjection, delProjectionActions)

export const putSetting = fetch.bind(null, api.putSetting, putSettingActions)
export const putBaselines = fetch.bind(null, api.putBaselines, putBaselinesActions)

export const getTeamStats = fetch.bind(null, api.getTeamStats, getTeamStatActions)

export const postWaiver = fetch.bind(null, api.postWaiver, postWaiverActions)
export const postWaiverOrder = fetch.bind(null, api.postWaiverOrder, postWaiverOrderActions)
export const postCancelWaiver = fetch.bind(null, api.postCancelWaiver, postCancelWaiverActions)
export const postPoach = fetch.bind(null, api.postPoach, postPoachActions)
export const fetchWaivers = fetch.bind(null, api.getWaivers, getWaiversActions)
export const getWaiverReport = fetch.bind(null, api.getWaiverReport, getWaiverReportActions)

export const getSchedule = fetch.bind(null, api.getSchedule, getScheduleActions)

export const postError = fetch.bind(null, api.postError, postErrorActions)
export const getStatus = fetch.bind(null, api.getStatus, getStatusActions)
