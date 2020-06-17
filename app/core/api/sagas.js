import { race, call, put, take, cancelled, select } from 'redux-saga/effects'
import { api, apiRequest } from '@core/api/service'
import { LOCATION_CHANGE } from 'connected-react-router'

import {
  authActions,
  loginActions,
  registerActions,
  getToken
} from '@core/app'

import { getDraftActions, postDraftActions } from '@core/draft'
import { getRosterActions, getRostersActions } from '@core/rosters'
import { playersRequestActions, getPlayerStatsActions } from '@core/players'
import { getTeamsActions } from '@core/teams'
import { getTransactionsActions } from '@core/transactions'
import { getMatchupsActions } from '@core/matchups'

function * fetchAPI (apiFunction, actions, opts = {}) {
  const token = yield select(getToken)
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
export const getRoster = fetch.bind(null, api.getRoster, getRosterActions)
export const getRosters = fetch.bind(null, api.getRosters, getRostersActions)

export const fetchDraft = fetch.bind(null, api.getDraft, getDraftActions)
export const postDraft = fetch.bind(null, api.postDraft, postDraftActions)

export const getTeams = fetch.bind(null, api.getTeams, getTeamsActions)
export const fetchTransactions = fetch.bind(null, api.getTransactions, getTransactionsActions)

export const getMatchups = fetch.bind(null, api.getMatchups, getMatchupsActions)
