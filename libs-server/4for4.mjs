import fetch from 'node-fetch'
import debug from 'debug'
import csv from 'csv-parser'

import db from '#db'
import * as cache from './cache.mjs'
import { constants } from '#libs-shared'

const log = debug('4for4')

export const get_4for4_config = async () => {
  const config_row = await db('config').where({ key: '4for4_config' }).first()
  return config_row.value
}

export const get_4for4_projections = async ({
  ignore_cache = false,
  year = constants.season.year,
  week = 0,
  is_regular_season_projection = true
} = {}) => {
  const four_for_four_config = await get_4for4_config()

  const cache_key = `/4for4/projections/${year}/${week}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for 4for4 projections for year: ${year}, week: ${week}`)
      return cache_value
    }
  }

  log(`fetching 4for4 projections for year: ${year}, week: ${week}`)
  const url = is_regular_season_projection
    ? four_for_four_config.season_projections_url
    : four_for_four_config.weekly_projections_url

  const data = await fetch(url, {
    headers: four_for_four_config.headers
  }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const results = []
        res.body
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('error', (error) => reject(error))
          .on('end', () => resolve(results))
      })
  )

  if (data && data.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
