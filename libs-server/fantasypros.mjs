import debug from 'debug'

import db from '#db'
import * as cache from './cache.mjs'
import { constants } from '#libs-shared'
import { fetch_with_retry } from './proxy-manager.mjs'

const log = debug('fantasypros')

export const get_fantasypros_config = async () => {
  const config_row = await db('config')
    .where({ key: 'fantasypros_config' })
    .first()
  return config_row.value
}

export const get_fantasypros_rankings = async ({
  ignore_cache = false,
  year = constants.season.year,
  week = 0,
  fantasypros_scoring_type = 'HALF',
  fantasypros_position_type = 'ALL'
} = {}) => {
  const ranking_type = week === 0 ? 'draft' : 'weekly'
  const cache_key = `/fantasypros/rankings/${year}/${week}/${fantasypros_scoring_type}/${fantasypros_position_type}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(
        `cache hit for fantasypros ${ranking_type} rankings for year: ${year}, week: ${week}, scoring: ${fantasypros_scoring_type}, position: ${fantasypros_position_type}`
      )
      return cache_value
    }
  }

  const fantasypros_config = await get_fantasypros_config()

  log(
    `fetching fantasypros ${ranking_type} rankings for year: ${year}, week: ${week}, scoring: ${fantasypros_scoring_type}, position: ${fantasypros_position_type}`
  )
  const url = `${fantasypros_config.api_url}/${year}/consensus-rankings?type=${ranking_type}&scoring=${fantasypros_scoring_type}&position=${fantasypros_position_type}&week=${week}&experts=available`
  log(`Fetching ${url}`)
  const data = await fetch_with_retry({
    url,
    headers: fantasypros_config.headers,
    response_type: 'json'
  })

  if (data && data.players) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
