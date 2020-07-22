/* global AbortController, fetch */

import queryString from 'query-string'
import merge from 'deepmerge'

import { BASE_URL } from '@core/constants'

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

const PUT = (data) => ({
  method: 'PUT',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

const DELETE = (data) => ({
  method: 'DELETE',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

export const api = {
  postRegister (data) {
    const url = `${BASE_URL}/auth/register`
    return { url, ...POST(data) }
  },
  postLogin (data) {
    const url = `${BASE_URL}/auth/login`
    return { url, ...POST(data) }
  },
  fetchAuth () {
    const url = `${BASE_URL}/me`
    return { url }
  },
  fetchPlayers (params) {
    const url = `${BASE_URL}/players?${queryString.stringify(params)}`
    return { url }
  },
  getPlayerStats ({ playerId }) {
    const url = `${BASE_URL}/players/${playerId}/stats`
    return { url }
  },
  getRoster ({ teamId }) {
    const url = `${BASE_URL}/teams/${teamId}/lineups`
    return { url }
  },
  getRosters ({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/rosters`
    return { url }
  },
  getDraft ({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/draft`
    return { url }
  },
  postDraft (data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/draft`
    return { url, ...POST(data) }
  },
  getTeams ({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/teams`
    return { url }
  },
  getMatchups ({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/schedule`
    return { url }
  },
  postMatchups ({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/schedule`
    return { url, ...POST() }
  },
  getTransactions (params) {
    const url = `${BASE_URL}/leagues/${params.leagueId}/transactions?${queryString.stringify(params)}`
    return { url }
  },
  getTrades (params) {
    const url = `${BASE_URL}/leagues/${params.leagueId}/trades?${queryString.stringify(params)}`
    return { url }
  },
  postProposeTrade (data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades`
    return { url, ...POST(data) }
  },
  postCancelTrade (data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/cancel`
    return { url, ...POST(data) }
  },
  postAcceptTrade (data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/accept`
    return { url, ...POST(data) }
  },
  postRejectTrade (data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/reject`
    return { url, ...POST(data) }
  },
  putLeague (data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}`
    return { url, ...PUT(data) }
  },
  putTeam (data) {
    const url = `${BASE_URL}/teams/${data.teamId}`
    return { url, ...PUT(data) }
  },
  getSources () {
    const url = `${BASE_URL}/sources`
    return { url }
  },
  putSource (data) {
    const url = `${BASE_URL}/sources/${data.sourceId}`
    return { url, ...PUT(data) }
  },
  putProjection (data) {
    const url = `${BASE_URL}/projections/${data.playerId}`
    return { url, ...PUT(data) }
  },
  delProjection (data) {
    const url = `${BASE_URL}/projections/${data.playerId}`
    return { url, ...DELETE(data) }
  },
  putSetting (data) {
    const url = `${BASE_URL}/me`
    return { url, ...PUT(data) }
  },
  putBaselines (data) {
    const url = `${BASE_URL}/me/baselines`
    return { url, ...PUT(data) }
  },
  getPlays (params) {
    const url = `${BASE_URL}/plays?${queryString.stringify(params)}`
    return { url }
  },
  getTeamStats () {
    const url = `${BASE_URL}/stats/teams`
    return { url }
  }
}

export const apiRequest = (apiFunction, opts, token) => {
  const controller = new AbortController()
  const abort = controller.abort.bind(controller)
  const headers = { Authorization: `Bearer ${token}` }
  const defaultOptions = { headers, credentials: 'include' }
  const options = merge(defaultOptions, apiFunction(opts), { signal: controller.signal })
  const request = dispatchFetch.bind(null, options)
  return { abort, request }
}

export const dispatchFetch = async (options) => {
  const response = await fetch(options.url, options)
  if (response.status >= 200 && response.status < 300) {
    return response.json()
  } else {
    const res = await response.json()
    const error = new Error(res.error || response.statusText)
    error.response = response
    throw error
  }
}
