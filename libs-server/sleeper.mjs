import fetch from 'node-fetch'
import debug from 'debug'

import db from '#db'
import * as cache from './cache.mjs'
import { current_season } from '#constants'

const log = debug('sleeper')

export const get_sleeper_config = async () => {
  const config_row = await db('config').where({ key: 'sleeper_config' }).first()
  return config_row.value
}

export const get_sleeper_projections = async ({
  ignore_cache = false,
  positions = ['DEF', 'K', 'QB', 'RB', 'TE', 'WR'],
  year = current_season.year,
  order_by = 'adp_std'
} = {}) => {
  const sleeper_config = await get_sleeper_config()

  const cache_key = `/sleeper/projections/${year}/${positions.sort().join('-')}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(
        `cache hit for sleeper projections for year: ${year}, positions: ${positions.join(', ')}`
      )
      return cache_value
    }
  }

  log(
    `fetching sleeper projections for year: ${year}, positions: ${positions.join(', ')}`
  )
  const url = `${sleeper_config.api_url}/projections/nfl/${year}?season_type=regular&${positions.map((p) => `positions[]=${p}`).join('&')}&order_by=${order_by}`
  const res = await fetch(url)
  const data = await res.json()

  if (data && data.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
