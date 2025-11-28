import { fetch as fetch_http2 } from 'fetch-h2'
import debug from 'debug'

import { current_season } from '#constants'
import * as cache from '../cache.mjs'
import { get_fanduel_dfs_config } from './fanduel-config.mjs'

const log = debug('fanduel:dfs')

export const get_dfs_fixtures = async ({ ignore_cache = false } = {}) => {
  const cache_key = `/fanduel/dfs/slates/${current_season.year}/${current_season.nfl_seas_type}/${current_season.nfl_seas_week}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log('cache hit for fanduel dfs fixtures')
      return cache_value
    }
  }

  const fanduel_dfs_config = await get_fanduel_dfs_config()
  const url = `${fanduel_dfs_config.api_url}/fixture-lists`

  log(`fetching ${url}`)
  log(fanduel_dfs_config.headers)
  const res = await fetch_http2(url, {
    headers: fanduel_dfs_config.headers
  })

  const data = await res.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_dfs_fixture_players = async ({
  fixture_id,
  ignore_cache = false
}) => {
  if (!fixture_id) {
    throw new Error('missing fixture_id')
  }

  const cache_key = `/fanduel/dfs/slate_players/${fixture_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for fanduel dfs fixture players with id: ${fixture_id}`)
      return cache_value
    }
  }

  const fanduel_dfs_config = await get_fanduel_dfs_config()
  const url = `${fanduel_dfs_config.api_url}/fixture-lists/${fixture_id}/players?content_sources=NUMBERFIRE,ROTOWIRE,ROTOGRINDERS`

  log(`fetching ${url}`)
  const res = await fetch_http2(url, {
    headers: fanduel_dfs_config.headers
  })

  const data = await res.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
