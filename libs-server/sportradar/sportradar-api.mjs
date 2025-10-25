import PQueue from 'p-queue'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import config from '#config'
import db from '#db'
import { wait } from '#libs-server'
import is_main from '../is-main.mjs'
import * as cache from '../cache.mjs'

const queue = new PQueue({ concurrency: 1 })
let last_request

const log = debug('sportradar')
debug.enable('sportradar')

// Helper to get Sportradar config from database
const get_sportradar_config = async () => {
  const config_row = await db('config')
    .where({ key: 'sportradar_config' })
    .first()

  if (config_row?.value) {
    return {
      api_key: config_row.value.api_key || config.sportradar_api,
      base_url:
        config_row.value.base_url ||
        'https://api.sportradar.com/nfl/official/trial/v7/en'
    }
  }

  // Fallback to config file
  return {
    api_key: config.sportradar_api,
    base_url: 'https://api.sportradar.com/nfl/official/trial/v7/en'
  }
}

export const getPlayer = ({ sportradar_id }) =>
  queue.add(async () => {
    const api_path = `players/${sportradar_id}/profile.json`
    const cache_key = `/sportradar/${api_path}`
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }

    const current_time = process.hrtime.bigint()
    if (last_request && current_time - last_request < 2e9) {
      await wait(2000)
    }
    last_request = process.hrtime.bigint()

    const url = `https://api.sportradar.us/nfl/official/trial/v7/en/${api_path}?api_key=${config.sportradar_api}`
    const res = await fetch(url)
    const data = await res.json()

    if (res.ok) {
      await cache.set({ key: cache_key, value: data })
    }

    return data
  })

export const get_games_schedule = ({ year, season_type = 'REG' }) =>
  queue.add(async () => {
    const cache_key = `/sportradar/schedule/${year}/${season_type}`
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`Cache hit for schedule ${year}/${season_type}`)
      return cache_value
    }

    const current_time = process.hrtime.bigint()
    if (last_request && current_time - last_request < 2e9) {
      await wait(2000)
    }
    last_request = process.hrtime.bigint()

    const { api_key, base_url } = await get_sportradar_config()
    const api_path = `games/${year}/${season_type}/schedule.json`
    const url = `${base_url}/${api_path}?api_key=${api_key}`

    log(`Fetching schedule: ${year}/${season_type}`)
    log(`URL: ${url.replace(api_key, 'REDACTED')}`)
    const res = await fetch(url)

    if (!res.ok) {
      log(`Error fetching schedule: ${res.status} ${res.statusText}`)
      const text = await res.text()
      log(`Response body: ${text.substring(0, 500)}`)
      throw new Error(`Sportradar API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    await cache.set({ key: cache_key, value: data })
    log(`Fetched ${data.weeks?.length || 0} weeks for ${year}/${season_type}`)

    return data
  })

export const get_game_play_by_play = ({ sportradar_game_id }) =>
  queue.add(async () => {
    const cache_key = `/sportradar/pbp/${sportradar_game_id}`
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`Cache hit for play-by-play ${sportradar_game_id}`)
      return cache_value
    }

    const current_time = process.hrtime.bigint()
    if (last_request && current_time - last_request < 2e9) {
      await wait(2000)
    }
    last_request = process.hrtime.bigint()

    const { api_key, base_url } = await get_sportradar_config()
    const api_path = `games/${sportradar_game_id}/pbp.json`
    const url = `${base_url}/${api_path}?api_key=${api_key}`

    log(`Fetching play-by-play: ${sportradar_game_id}`)
    log(`URL: ${url.replace(api_key, 'REDACTED')}`)
    const res = await fetch(url)

    if (!res.ok) {
      log(`Error fetching play-by-play: ${res.status} ${res.statusText}`)
      const text = await res.text()
      log(`Response body: ${text.substring(0, 500)}`)
      throw new Error(`Sportradar API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    await cache.set({ key: cache_key, value: data })
    log(
      `Fetched play-by-play with ${data.periods?.length || 0} periods for game ${sportradar_game_id}`
    )

    return data
  })

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('id', {
      describe: 'Sportradar player ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()

    if (!argv.id) {
      log('missing --id')
      process.exit()
    }

    const data = await getPlayer({ sportradar_id: argv.id })
    log(data)
  } catch (err) {
    error = err
    log(error)
  }
}

if (is_main(import.meta.url)) {
  main()
}
