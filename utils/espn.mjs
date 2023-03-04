import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'
import { wait } from './wait.mjs'
import * as cache from './cache.mjs'

const log = debug('espn')
debug.enable('espn')

export const getPlayer = async ({ espn_id }) => {
  const cache_key = `/espn/players/${espn_id}.json`
  const cache_value = await cache.get({ key: cache_key })
  if (cache_value) {
    return cache_value
  }

  const url = `${config.espn_api_v3_url}/athletes/${espn_id}`
  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  await wait(4000)

  if (res.ok) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const getPlayers = async ({ page = 1 }) => {
  const url = `${config.espn_api_v2_url}/athletes?limit=1000&page=${page}`
  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()
  return data
}
