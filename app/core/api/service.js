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

const DELETE = {
  method: 'DELETE'
}

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
  getRoster ({ teamId }) {
    const url = `${BASE_URL}/teams/${teamId}/lineups`
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
