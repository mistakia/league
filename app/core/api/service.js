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
  postLogout () {
    const url = `${BASE_URL}/auth/logout`
    return { url, ...POST() }
  },
  fetchAuth () {
    const url = `${BASE_URL}/me`
    return { url }
  },
  fetchPlayers (params) {
    const url = `${BASE_URL}/players?${queryString.stringify(params)}`
    return { url }
  },
  getRoster (params) {
    const url = `${BASE_URL}/teams/${params.teamId}/lineups`
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

export const dispatchFetch = (options) => {
  return fetch(options.url, options).then(response => {
    const res = response.json()
    if (response.status >= 200 && response.status < 300) {
      return res
    } else {
      const error = new Error(res.error || response.statusText)
      error.response = response
      throw error
    }
  })
}
