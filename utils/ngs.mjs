import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'
import * as cache from './cache.mjs'

const log = debug('ngs')
debug.enable('ngs')

export const getPlayer = async ({ ignore_cache = false, nflId } = {}) => {
  if (!nflId) {
    return
  }

  const cache_key = `/ngs/player/${nflId}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs player with nflId: ${nflId}`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/league/player?nflId=${nflId}`
  log(`fetching ngs player with nflId: ${nflId}`)
  const res = await fetch(url, {
    headers: { referer: 'https://nextgenstats.nfl.com/' }
  })
  const data = await res.json()

  if (data && data.displayName) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
