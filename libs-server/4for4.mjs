import debug from 'debug'
import { Readable } from 'node:stream'
import csv from 'csv-parser'

import db from '#db'
import * as cache from './cache.mjs'
import { current_season } from '#constants'

const log = debug('4for4')

export const get_4for4_config = async () => {
  const config_row = await db('config').where({ key: '4for4_config' }).first()
  return config_row.value
}

export const get_4for4_projections = async ({
  ignore_cache = false,
  year = current_season.year,
  week = 0,
  seas_type = current_season.nfl_seas_type,
  is_regular_season_projection = true
} = {}) => {
  const four_for_four_config = await get_4for4_config()

  const cache_key = `/4for4/projections/${year}/${seas_type}/${week}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(
        `cache hit for 4for4 projections for year: ${year}, seas_type: ${seas_type}, week: ${week}`
      )
      return cache_value
    }
  }

  log(
    `fetching 4for4 projections for year: ${year}, seas_type: ${seas_type}, week: ${week}`
  )
  const url = is_regular_season_projection
    ? four_for_four_config.season_projections_url
    : four_for_four_config.weekly_projections_url

  const res = await fetch(url, {
    headers: four_for_four_config.headers
  })

  // An expired 4for4 session cookie 302-redirects the projections_csv endpoint
  // to /user/login and serves an HTML page with a 200. csv-parser then yields
  // rows with no recognizable columns, which previously surfaced downstream as
  // the misleading "No Week column found in data". Detect the auth/format
  // failure here and throw a clear, actionable error pointing at the cookie.
  const content_type = res.headers.get('content-type') || ''
  const redirected_to_login = res.redirected && /\/user\/login/.test(res.url)
  if (redirected_to_login || /text\/html/i.test(content_type)) {
    throw new Error(
      `4for4 returned HTML instead of CSV (status=${res.status}${
        res.redirected ? `, redirected to ${res.url}` : ''
      }) -- the 4for4 session cookie in config.4for4_config.headers.cookie has likely expired; refresh it`
    )
  }

  const data = await new Promise((resolve, reject) => {
    const results = []
    Readable.fromWeb(res.body)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('error', (error) => reject(error))
      .on('end', () => resolve(results))
  })

  if (data && data.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
