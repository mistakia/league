import debug from 'debug'
import diff from 'deep-diff'

import db from '#db'
import insert_prop_market_selections from './insert-prop-market-selections.mjs'
import batch_insert from './batch-insert.mjs'
import {
  prefetch_existing_markets,
  prefetch_existing_selections,
  get_cached_market_latest,
  get_cached_market_before_timestamp,
  clear_cache,
  get_cache_stats
} from './betting-market-cache.mjs'

const log = debug('insert-prop-markets')

const MARKET_BATCH_SIZE = 100
const SELECTION_BATCH_SIZE = 500

// Fields that trigger a history insert when changed
const MARKET_HISTORY_UPDATE_FIELDS = [
  'open',
  'selection_count',
  'live',
  'source_market_name'
]

// Fields that trigger an index update when changed
const MARKET_INDEX_UPDATE_FIELDS = ['esbid', 'year']

// Deduplicate inserts by generating a unique key for each record
const deduplicate_inserts = (inserts, get_key) => {
  const unique = new Map()
  for (const insert of inserts) {
    unique.set(get_key(insert), insert)
  }
  return [...unique.values()]
}

// Clean up stale selections that are no longer in the current market snapshot
const cleanup_stale_selections = async (cleanup_operations) => {
  if (cleanup_operations.length === 0) {
    return
  }

  const cleanup_market_ids = cleanup_operations
    .filter((op) => op.source_market_id && op.new_selection_ids)
    .map((op) => op.source_market_id)

  if (cleanup_market_ids.length === 0) {
    return
  }

  // Build a map of market_id -> valid selection_ids (merge duplicates)
  const valid_selections_by_market = new Map()
  for (const op of cleanup_operations) {
    if (op.source_market_id && op.new_selection_ids) {
      const existing_set = valid_selections_by_market.get(op.source_market_id)
      if (existing_set) {
        for (const id of op.new_selection_ids) {
          existing_set.add(id)
        }
      } else {
        valid_selections_by_market.set(
          op.source_market_id,
          new Set(op.new_selection_ids)
        )
      }
    }
  }

  // Single query to get all existing selections for cleanup markets
  const existing_selections = await db('prop_market_selections_index')
    .whereIn('source_market_id', cleanup_market_ids)
    .where('time_type', 'CLOSE')
    .select('source_market_id', 'source_selection_id')

  // Group selections to delete by market_id
  const delete_by_market = new Map()
  for (const sel of existing_selections) {
    const valid_ids = valid_selections_by_market.get(sel.source_market_id)
    const sel_id_str = String(sel.source_selection_id)
    if (valid_ids && !valid_ids.has(sel_id_str)) {
      if (!delete_by_market.has(sel.source_market_id)) {
        delete_by_market.set(sel.source_market_id, [])
      }
      delete_by_market.get(sel.source_market_id).push(sel.source_selection_id)
    }
  }

  // Execute deletes in parallel
  if (delete_by_market.size > 0) {
    await Promise.all(
      [...delete_by_market.entries()].map(([market_id, selection_ids]) =>
        db('prop_market_selections_index')
          .where({ source_market_id: market_id, time_type: 'CLOSE' })
          .whereIn('source_selection_id', selection_ids)
          .del()
      )
    )
  }
}

// Extract fields needed for market history inserts
const get_market_history_record = (market, timestamp) => ({
  source_id: market.source_id,
  source_market_id: market.source_market_id,
  source_market_name: market.source_market_name,
  open: market.open,
  live: market.live,
  selection_count: market.selection_count,
  timestamp
})

const process_market = async ({ timestamp, selections, ...market }) => {
  const { source_id, source_market_id } = market

  if (!source_id) {
    throw new Error('source_id is required')
  }

  if (!source_market_id) {
    throw new Error('source_market_id is required')
  }

  const market_history_inserts = []
  const market_index_inserts = []

  const existing_market = get_cached_market_latest({
    source_id,
    source_market_id
  })

  // Track for selection processing - will be set if we have a valid previous state
  let market_for_selection_lookup = existing_market

  if (!existing_market) {
    // New market - insert history and index records
    market_history_inserts.push(get_market_history_record(market, timestamp))

    market_index_inserts.push({
      ...market,
      timestamp,
      time_type: 'OPEN'
    })

    if (!market.live) {
      market_index_inserts.push({
        ...market,
        timestamp,
        time_type: 'CLOSE'
      })
    }
  } else {
    // Existing market - find the version before this timestamp for comparison
    const previous_market_row = get_cached_market_before_timestamp({
      source_id,
      source_market_id,
      timestamp
    })

    if (!previous_market_row) {
      // No market existed before this timestamp - insert as new history entry
      market_history_inserts.push(get_market_history_record(market, timestamp))
    } else {
      // Create a copy for comparison to avoid mutating cached object
      const { timestamp: _, ...market_to_compare } = previous_market_row
      market_to_compare.open = Boolean(market_to_compare.open)
      market_to_compare.live = Boolean(market_to_compare.live)

      const differences = diff(market_to_compare, market)

      if (differences && differences.length) {
        const should_update_history = differences.some((d) =>
          MARKET_HISTORY_UPDATE_FIELDS.includes(d.path[0])
        )

        if (should_update_history) {
          market_history_inserts.push(
            get_market_history_record(market, timestamp)
          )
        }

        const should_update_index = differences.some((d) =>
          MARKET_INDEX_UPDATE_FIELDS.includes(d.path[0])
        )

        if (should_update_index) {
          market_index_inserts.push({
            ...market,
            timestamp,
            time_type: 'OPEN'
          })
          market_index_inserts.push({
            ...market,
            timestamp,
            time_type: 'CLOSE'
          })
        }
      }

      // Use the previous row for selection lookup since it wasn't mutated
      market_for_selection_lookup = previous_market_row
    }

    // Update CLOSE index if this is newer than existing and not live
    if (!market.live && timestamp > existing_market.timestamp) {
      market_index_inserts.push({
        ...market,
        timestamp,
        time_type: 'CLOSE'
      })
    }
  }

  // Process selections and get their operations
  const selection_operations = await insert_prop_market_selections({
    timestamp,
    selections,
    existing_market: market_for_selection_lookup,
    market
  })

  return {
    market_history_inserts,
    market_index_inserts,
    selection_operations
  }
}

export default async function (markets, { dry_run = false } = {}) {
  if (!markets || markets.length === 0) {
    return { stats: null }
  }

  // Accumulate stats for dry run reporting
  const stats = {
    total_markets: markets.length,
    market_history_inserts: 0,
    market_index_inserts: 0,
    selection_history_inserts: 0,
    selection_index_inserts: 0,
    cleanup_operations: 0
  }

  const total_start = Date.now()
  log(
    `Processing ${markets.length} markets with batch size ${MARKET_BATCH_SIZE}`
  )

  // Extract unique source_ids from markets
  const source_ids = [...new Set(markets.map((m) => m.source_id))]

  // Pre-fetch all existing data in parallel
  const prefetch_start = Date.now()
  await Promise.all([
    prefetch_existing_markets({ source_ids }),
    prefetch_existing_selections({ source_ids })
  ])
  const prefetch_duration = ((Date.now() - prefetch_start) / 1000).toFixed(2)

  const cache_stats = get_cache_stats()
  log(
    `Cache loaded in ${prefetch_duration}s: ${cache_stats.markets_count} markets, ${cache_stats.selections_count} selections`
  )

  // Process markets in batches
  let batch_count = 0
  const total_batches = Math.ceil(markets.length / MARKET_BATCH_SIZE)

  await batch_insert({
    items: markets,
    batch_size: MARKET_BATCH_SIZE,
    save: async (market_batch) => {
      batch_count++
      const batch_start = Date.now()
      const all_market_history_inserts = []
      const all_market_index_inserts = []
      const all_selection_history_inserts = []
      const all_selection_index_inserts = []
      const all_selection_cleanup_operations = []

      // Process all markets in the batch concurrently
      const market_results = await Promise.allSettled(
        market_batch.map((market) => process_market(market))
      )

      // Collect results from successful market processing
      for (let i = 0; i < market_results.length; i++) {
        const result = market_results[i]
        if (result.status === 'fulfilled') {
          const operations = result.value
          all_market_history_inserts.push(...operations.market_history_inserts)
          all_market_index_inserts.push(...operations.market_index_inserts)

          if (operations.selection_operations) {
            all_selection_history_inserts.push(
              ...operations.selection_operations.selection_history_inserts
            )
            all_selection_index_inserts.push(
              ...operations.selection_operations.selection_index_inserts
            )
            all_selection_cleanup_operations.push(
              ...operations.selection_operations.cleanup_operations
            )
          }
        } else {
          log('Error processing market:', market_batch[i])
          log(result.reason)
        }
      }

      // Deduplicate all inserts to avoid constraint violations
      const unique_market_history = deduplicate_inserts(
        all_market_history_inserts,
        (i) => `${i.source_id}_${i.source_market_id}_${i.timestamp}`
      )

      const unique_market_index = deduplicate_inserts(
        all_market_index_inserts,
        (i) => `${i.source_id}_${i.source_market_id}_${i.time_type}`
      )

      const unique_selection_history = deduplicate_inserts(
        all_selection_history_inserts,
        (i) =>
          `${i.source_id}_${i.source_market_id}_${i.source_selection_id}_${i.timestamp}`
      )

      const unique_selection_index = deduplicate_inserts(
        all_selection_index_inserts,
        (i) =>
          `${i.source_id}_${i.source_market_id}_${i.source_selection_id}_${i.time_type}`
      )

      // Accumulate stats
      stats.market_history_inserts += unique_market_history.length
      stats.market_index_inserts += unique_market_index.length
      stats.selection_history_inserts += unique_selection_history.length
      stats.selection_index_inserts += unique_selection_index.length
      stats.cleanup_operations += all_selection_cleanup_operations.length

      // Skip actual DB operations in dry run mode
      if (!dry_run) {
        // Execute all insert operations in parallel
        const insert_promises = []

        if (unique_market_history.length > 0) {
          insert_promises.push(
            db('prop_markets_history')
              .insert(unique_market_history)
              .onConflict(['source_id', 'source_market_id', 'timestamp'])
              .merge()
          )
        }

        if (unique_market_index.length > 0) {
          insert_promises.push(
            db('prop_markets_index')
              .insert(unique_market_index)
              .onConflict(['source_id', 'source_market_id', 'time_type'])
              .merge()
          )
        }

        if (unique_selection_history.length > 0) {
          insert_promises.push(
            batch_insert({
              items: unique_selection_history,
              batch_size: SELECTION_BATCH_SIZE,
              save: async (selection_batch) => {
                await db('prop_market_selections_history')
                  .insert(selection_batch)
                  .onConflict([
                    'source_id',
                    'source_market_id',
                    'source_selection_id',
                    'timestamp'
                  ])
                  .merge()
              }
            })
          )
        }

        if (unique_selection_index.length > 0) {
          insert_promises.push(
            batch_insert({
              items: unique_selection_index,
              batch_size: SELECTION_BATCH_SIZE,
              save: async (selection_batch) => {
                await db('prop_market_selections_index')
                  .insert(selection_batch)
                  .onConflict([
                    'source_id',
                    'source_market_id',
                    'source_selection_id',
                    'time_type'
                  ])
                  .merge()
              }
            })
          )
        }

        // Wait for all inserts to complete
        await Promise.all(insert_promises)

        // Clean up stale selections
        await cleanup_stale_selections(all_selection_cleanup_operations)
      }

      const batch_duration = ((Date.now() - batch_start) / 1000).toFixed(2)
      log(
        `Batch ${batch_count}/${total_batches} completed in ${batch_duration}s (${market_batch.length} markets, ${unique_selection_history.length} selection inserts)`
      )
    }
  })

  // Clear cache after processing
  clear_cache()
  const total_duration = ((Date.now() - total_start) / 1000).toFixed(2)

  if (dry_run) {
    log(`\n=== DRY RUN - NO DB WRITES ===`)
    log(`Processing completed in ${total_duration}s`)
    log(`Would insert:`)
    log(`  - Market history records: ${stats.market_history_inserts}`)
    log(`  - Market index records: ${stats.market_index_inserts}`)
    log(`  - Selection history records: ${stats.selection_history_inserts}`)
    log(`  - Selection index records: ${stats.selection_index_inserts}`)
    log(`  - Cleanup operations: ${stats.cleanup_operations}`)
  } else {
    log(`Market insertion completed in ${total_duration}s`)
  }

  return { stats }
}
