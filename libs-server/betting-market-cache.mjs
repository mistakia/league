import debug from 'debug'
import db from '#db'

const log = debug('betting-market-cache')

const markets_cache = new Map()
const selections_cache = new Map()

export const prefetch_existing_markets = async ({ source_ids }) => {
  log(`Pre-fetching markets for sources: ${source_ids.join(', ')}`)

  // Add date constraint to limit the query to recent data (last 7 days)
  const one_week_ago = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)

  const existing_markets = await db('prop_markets_history')
    .whereIn('source_id', source_ids)
    .where('timestamp', '>=', one_week_ago)
    .select('*')

  log(
    `Loaded ${existing_markets.length} existing markets into cache (last 7 days)`
  )

  const markets_by_timestamp = new Map()

  for (const market of existing_markets) {
    const cache_key = `${market.source_id}_${market.source_market_id}`

    if (!markets_by_timestamp.has(cache_key)) {
      markets_by_timestamp.set(cache_key, [])
    }

    markets_by_timestamp.get(cache_key).push(market)
  }

  for (const [cache_key, market_versions] of markets_by_timestamp) {
    market_versions.sort((a, b) => b.timestamp - a.timestamp)
    markets_cache.set(cache_key, market_versions)
  }

  return markets_cache
}

export const prefetch_existing_selections = async ({ source_ids }) => {
  log(`Pre-fetching selections for sources: ${source_ids.join(', ')}`)

  // Add date constraint to limit the query to recent data (last 7 days)
  const one_week_ago = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)

  const existing_selections = await db('prop_market_selections_history')
    .whereIn('source_id', source_ids)
    .where('timestamp', '>=', one_week_ago)
    .select('*')

  log(
    `Loaded ${existing_selections.length} existing selections into cache (last 7 days)`
  )

  const selections_by_timestamp = new Map()

  for (const selection of existing_selections) {
    const cache_key = `${selection.source_id}_${selection.source_market_id}_${selection.source_selection_id}`

    if (!selections_by_timestamp.has(cache_key)) {
      selections_by_timestamp.set(cache_key, [])
    }

    selections_by_timestamp.get(cache_key).push(selection)
  }

  for (const [cache_key, selection_versions] of selections_by_timestamp) {
    selection_versions.sort((a, b) => b.timestamp - a.timestamp)
    selections_cache.set(cache_key, selection_versions)
  }

  return selections_cache
}

export const get_cached_market_latest = ({ source_id, source_market_id }) => {
  const cache_key = `${source_id}_${source_market_id}`
  const market_versions = markets_cache.get(cache_key)

  if (!market_versions || market_versions.length === 0) {
    return null
  }

  return market_versions[0]
}

export const get_cached_market_before_timestamp = ({
  source_id,
  source_market_id,
  timestamp
}) => {
  const cache_key = `${source_id}_${source_market_id}`
  const market_versions = markets_cache.get(cache_key)

  if (!market_versions || market_versions.length === 0) {
    return null
  }

  return market_versions.find((m) => m.timestamp <= timestamp) || null
}

export const get_cached_selection_latest = ({
  source_id,
  source_market_id,
  source_selection_id
}) => {
  const cache_key = `${source_id}_${source_market_id}_${source_selection_id}`
  const selection_versions = selections_cache.get(cache_key)

  if (!selection_versions || selection_versions.length === 0) {
    return null
  }

  return selection_versions[0]
}

export const clear_cache = () => {
  markets_cache.clear()
  selections_cache.clear()
  log('Cache cleared')
}

export const get_cache_stats = () => {
  return {
    markets_count: markets_cache.size,
    selections_count: selections_cache.size
  }
}
