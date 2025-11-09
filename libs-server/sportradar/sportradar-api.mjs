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

// Helper to monitor queue during long waits
const monitor_queue_wait = ({
  sportradar_game_id,
  enqueue_time,
  interval_ms = 10000
}) => {
  const monitor_interval = setInterval(() => {
    const wait_time = Date.now() - enqueue_time
    const queue_size = queue.size
    const queue_pending = queue.pending

    if (wait_time > interval_ms) {
      log(
        `Queue wait monitor [${sportradar_game_id}]: waiting ${(wait_time / 1000).toFixed(2)}s (queue: ${queue_pending} running, ${queue_size} pending)`
      )
    }
  }, interval_ms)

  return () => clearInterval(monitor_interval)
}

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

export const get_game_play_by_play = ({ sportradar_game_id }) => {
  const enqueue_time = Date.now()
  const queue_size_before = queue.size
  const queue_pending_before = queue.pending
  log(
    `Enqueuing play-by-play request: ${sportradar_game_id} (queue: ${queue_pending_before} running, ${queue_size_before} pending)`
  )

  // Start monitoring queue wait time
  const stop_monitoring = monitor_queue_wait({
    sportradar_game_id,
    enqueue_time
  })

  return queue
    .add(async () => {
      stop_monitoring() // Stop monitoring once task starts
      const task_start_time = Date.now()
      const queue_wait_time = task_start_time - enqueue_time

      if (queue_wait_time > 1000) {
        log(
          `Task started after ${(queue_wait_time / 1000).toFixed(2)}s wait: play-by-play ${sportradar_game_id}`
        )
      }

      const cache_key = `/sportradar/pbp/${sportradar_game_id}`

      // Time cache operation
      const cache_start_time = Date.now()
      const cache_value = await cache.get({ key: cache_key })
      const cache_time = Date.now() - cache_start_time

      if (cache_time > 1000) {
        log(
          `Cache get took ${(cache_time / 1000).toFixed(2)}s for play-by-play ${sportradar_game_id}`
        )
      }

      if (cache_value) {
        const total_time = Date.now() - task_start_time
        const queue_size_after = queue.size
        const queue_pending_after = queue.pending
        log(
          `Cache hit for play-by-play ${sportradar_game_id} (cache: ${cache_time}ms, total: ${total_time}ms, queue_wait: ${(queue_wait_time / 1000).toFixed(2)}s, queue: ${queue_pending_after} running, ${queue_size_after} pending)`
        )
        return cache_value
      }

      log(
        `Cache miss for play-by-play ${sportradar_game_id}, fetching from API`
      )

      // Rate limiting check
      const current_time = process.hrtime.bigint()
      if (last_request && current_time - last_request < 2e9) {
        const wait_time = 2000
        log(`Rate limiting: waiting ${wait_time}ms before API call`)
        await wait(wait_time)
      }
      last_request = process.hrtime.bigint()

      // Get config (could be slow if DB query)
      const config_start_time = Date.now()
      const { api_key, base_url } = await get_sportradar_config()
      const config_time = Date.now() - config_start_time
      if (config_time > 500) {
        log(`Config fetch took ${config_time}ms`)
      }

      const api_path = `games/${sportradar_game_id}/pbp.json`
      const url = `${base_url}/${api_path}?api_key=${api_key}`

      log(`Fetching play-by-play: ${sportradar_game_id}`)
      log(`URL: ${url.replace(api_key, 'REDACTED')}`)

      // Time API call
      const api_start_time = Date.now()
      const res = await fetch(url)
      const api_time = Date.now() - api_start_time
      log(
        `API call took ${(api_time / 1000).toFixed(2)}s for play-by-play ${sportradar_game_id}`
      )

      if (!res.ok) {
        log(`Error fetching play-by-play: ${res.status} ${res.statusText}`)
        const text = await res.text()
        log(`Response body: ${text.substring(0, 500)}`)
        throw new Error(`Sportradar API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()

      // Time cache set
      const cache_set_start_time = Date.now()
      await cache.set({ key: cache_key, value: data })
      const cache_set_time = Date.now() - cache_set_start_time
      if (cache_set_time > 1000) {
        log(
          `Cache set took ${(cache_set_time / 1000).toFixed(2)}s for play-by-play ${sportradar_game_id}`
        )
      }

      const total_time = Date.now() - task_start_time
      const queue_size_after = queue.size
      const queue_pending_after = queue.pending
      log(
        `Fetched play-by-play with ${data.periods?.length || 0} periods for game ${sportradar_game_id} (total: ${(total_time / 1000).toFixed(2)}s, API: ${(api_time / 1000).toFixed(2)}s, cache_set: ${cache_set_time}ms, queue: ${queue_pending_after} running, ${queue_size_after} pending)`
      )

      return data
    })
    .then(
      (result) => {
        stop_monitoring() // Ensure monitoring stops on success
        const queue_size_final = queue.size
        const queue_pending_final = queue.pending
        if (queue_size_final > 0 || queue_pending_final > 0) {
          log(
            `Task completed for play-by-play ${sportradar_game_id}, queue status: ${queue_pending_final} running, ${queue_size_final} pending`
          )
        }
        return result
      },
      (error) => {
        stop_monitoring() // Ensure monitoring stops on error
        log(
          `Task failed for play-by-play ${sportradar_game_id}: ${error.message}`
        )
        throw error
      }
    )
}

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
