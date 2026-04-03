import { fetch as fetch_http2 } from 'fetch-h2'
import debug from 'debug'

import { current_season } from '#constants'
import * as cache from '../cache.mjs'
import { get_fanduel_dfs_config } from './fanduel-config.mjs'
import { wait } from '#libs-server/wait.mjs'

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

export const get_fanduel_dfs_contests = async ({
  fixture_list_id,
  headers
}) => {
  if (!fixture_list_id) {
    throw new Error('missing fixture_list_id')
  }

  const fanduel_dfs_config = await get_fanduel_dfs_config()
  const request_headers = headers || fanduel_dfs_config.headers
  const url = `${fanduel_dfs_config.api_url}/contests?fixture_list=${fixture_list_id}&include_restricted=false`

  log(`fetching contests for fixture list ${fixture_list_id}`)
  const res = await fetch_http2(url, {
    headers: request_headers
  })

  const data = await res.json()
  return data
}

export const get_fanduel_contest_entries = async ({
  contest_id,
  page = 1,
  page_size = 100,
  headers
}) => {
  if (!contest_id) {
    throw new Error('missing contest_id')
  }
  if (!headers) {
    throw new Error('missing headers -- entries endpoint requires DFS auth')
  }

  const fanduel_dfs_config = await get_fanduel_dfs_config()
  const url = `${fanduel_dfs_config.api_url}/contests/${contest_id}/entries?page=${page}&page_size=${page_size}`

  log(`fetching entries for contest ${contest_id} page ${page}`)
  const res = await fetch_http2(url, {
    headers,
    timeout: 30000
  })

  if (!res.ok) {
    throw new Error(
      `entries request failed for contest ${contest_id}: ${res.status}`
    )
  }

  const data = await res.json()
  return data
}

export const get_fanduel_entry_detail = async ({ entry_id, headers }) => {
  if (!entry_id) {
    throw new Error('missing entry_id')
  }
  if (!headers) {
    throw new Error('missing headers -- entry detail requires DFS auth')
  }

  const fanduel_dfs_config = await get_fanduel_dfs_config()
  const url = `${fanduel_dfs_config.api_url}/entries/${entry_id}?include_projections=false`

  log(`fetching entry detail ${entry_id}`)
  const res = await fetch_http2(url, {
    headers,
    timeout: 30000
  })

  if (!res.ok) {
    throw new Error(
      `entry detail request failed for ${entry_id}: ${res.status}`
    )
  }

  const data = await res.json()
  return data
}

export const compute_fanduel_ownership = async ({
  contest_id,
  headers,
  sample_size = 2000,
  request_delay_ms = 2000
}) => {
  if (!contest_id) {
    throw new Error('missing contest_id')
  }
  if (!headers) {
    throw new Error('missing headers')
  }

  const player_counts = new Map()
  let total_entries_sampled = 0
  const page_size = 100
  const pages_needed = Math.ceil(sample_size / page_size)

  // Phase 1: collect entry IDs from bulk endpoint
  const entry_ids = []
  for (let page = 1; page <= pages_needed; page++) {
    const entries_data = await get_fanduel_contest_entries({
      contest_id,
      page,
      page_size,
      headers
    })

    if (!entries_data?.entries || entries_data.entries.length === 0) {
      break
    }

    for (const entry of entries_data.entries) {
      if (entry.id) {
        entry_ids.push(entry.id)
      }
    }

    if (entries_data.entries.length < page_size) {
      break
    }

    await wait(request_delay_ms)
  }

  log(`collected ${entry_ids.length} entry IDs for contest ${contest_id}`)

  // Phase 2: fetch individual entry details for lineup picks
  for (const entry_id of entry_ids) {
    try {
      const entry_detail = await get_fanduel_entry_detail({
        entry_id,
        headers
      })

      const lineup =
        entry_detail?.roster?.lineup || entry_detail?.lineup || []
      for (const slot of lineup) {
        const fixture_player_id =
          slot?.player?._members?.[0] || slot?.fixture_player_id
        if (fixture_player_id) {
          player_counts.set(
            fixture_player_id,
            (player_counts.get(fixture_player_id) || 0) + 1
          )
        }
      }

      total_entries_sampled++
    } catch (err) {
      log(`failed to fetch entry ${entry_id}: ${err.message}`)
    }

    await wait(request_delay_ms)
  }

  // Phase 3: compute ownership percentages
  const ownership = []
  for (const [fixture_player_id, count] of player_counts) {
    ownership.push({
      fixture_player_id,
      ownership_pct: Number(
        ((count / total_entries_sampled) * 100).toFixed(2)
      )
    })
  }

  return {
    ownership,
    total_entries_sampled,
    total_players: ownership.length
  }
}
