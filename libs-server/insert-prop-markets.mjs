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
debug.enable('insert-prop-markets')

const MARKET_BATCH_SIZE = 100
const SELECTION_BATCH_SIZE = 500

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

  // get existing market from cache
  const existing_market = get_cached_market_latest({
    source_id: market.source_id,
    source_market_id: market.source_market_id
  })

  let previous_market_row = null

  // if market does not exist, insert it
  if (!existing_market) {
    const {
      source_id,
      source_market_id,
      source_market_name,
      open,
      live,
      selection_count
    } = market

    market_history_inserts.push({
      source_id,
      source_market_id,
      source_market_name,
      open,
      live,
      selection_count,
      timestamp
    })

    market_index_inserts.push({
      ...market,
      timestamp,
      time_type: 'OPEN'
    })

    if (!live) {
      market_index_inserts.push({
        ...market,
        timestamp,
        time_type: 'CLOSE'
      })
    }
  } else {
    // existing market might be newer than this current market snapshot
    previous_market_row = get_cached_market_before_timestamp({
      source_id: market.source_id,
      source_market_id: market.source_market_id,
      timestamp
    })

    if (!previous_market_row) {
      const {
        source_id,
        source_market_id,
        source_market_name,
        open,
        live,
        selection_count
      } = market

      market_history_inserts.push({
        timestamp,
        source_id,
        source_market_id,
        source_market_name,
        open,
        live,
        selection_count
      })
    } else {
      // format previous_market_row to convert `open` and `live` to booleans for comparison
      previous_market_row.open = Boolean(previous_market_row.open)
      previous_market_row.live = Boolean(previous_market_row.live)

      // remove timestamp from existing market
      delete previous_market_row.timestamp

      // get differences between existing market and new market
      const differences = diff(previous_market_row, market)

      if (differences && differences.length) {
        // insert market into `prop_markets_history` table when open, selection_count, or live changes
        const update_on_change = [
          'open',
          'selection_count',
          'live',
          'source_market_name'
        ]
        const should_update = differences.some((difference) =>
          update_on_change.includes(difference.path[0])
        )

        if (should_update) {
          const {
            source_id,
            source_market_id,
            source_market_name,
            open,
            live,
            selection_count
          } = market

          market_history_inserts.push({
            timestamp,
            source_id,
            source_market_id,
            source_market_name,
            open,
            live,
            selection_count
          })
        }

        // Check for esbid or year changes and force index updates
        const esbid_changed = differences.some(
          (diff) => diff.path[0] === 'esbid'
        )
        const year_changed = differences.some((diff) => diff.path[0] === 'year')

        if (esbid_changed || year_changed) {
          // Update both OPEN and CLOSE entries in index
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
    }

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
    existing_market: previous_market_row || existing_market,
    market,
    use_cache: true
  })

  return {
    market_history_inserts,
    market_index_inserts,
    selection_operations
  }
}

export default async function (markets) {
  if (!markets || markets.length === 0) {
    return
  }

  log(
    `Processing ${markets.length} markets with batch size ${MARKET_BATCH_SIZE}`
  )

  // Extract unique source_ids from markets
  const source_ids = [...new Set(markets.map((m) => m.source_id))]

  // Pre-fetch all existing data
  await prefetch_existing_markets({ source_ids })
  await prefetch_existing_selections({ source_ids })

  const cache_stats = get_cache_stats()
  log(
    `Cache loaded: ${cache_stats.markets_count} markets, ${cache_stats.selections_count} selections`
  )

  // Process markets in batches
  await batch_insert({
    items: markets,
    batch_size: MARKET_BATCH_SIZE,
    save: async (market_batch) => {
      const all_market_history_inserts = []
      const all_market_index_inserts = []
      const all_selection_history_inserts = []
      const all_selection_index_inserts = []
      const all_selection_cleanup_operations = []

      // Process each market in the batch
      for (const market of market_batch) {
        try {
          const operations = await process_market(market)

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
        } catch (err) {
          log('Error processing market:', market)
          console.log(err)
          log(err)
        }
      }

      // Execute batch inserts - deduplicate to avoid constraint violations
      if (all_market_history_inserts.length > 0) {
        // Deduplicate market history inserts by composite key
        const unique_market_history_inserts = new Map()
        for (const insert of all_market_history_inserts) {
          const key = `${insert.source_id}_${insert.source_market_id}_${insert.timestamp}`
          unique_market_history_inserts.set(key, insert)
        }

        await db('prop_markets_history')
          .insert([...unique_market_history_inserts.values()])
          .onConflict(['source_id', 'source_market_id', 'timestamp'])
          .merge()
      }

      if (all_market_index_inserts.length > 0) {
        // Deduplicate market index inserts by composite key
        const unique_market_index_inserts = new Map()
        for (const insert of all_market_index_inserts) {
          const key = `${insert.source_id}_${insert.source_market_id}_${insert.time_type}`
          unique_market_index_inserts.set(key, insert)
        }

        await db('prop_markets_index')
          .insert([...unique_market_index_inserts.values()])
          .onConflict(['source_id', 'source_market_id', 'time_type'])
          .merge()
      }

      if (all_selection_history_inserts.length > 0) {
        // Deduplicate selection history inserts by composite key
        const unique_selection_history_inserts = new Map()
        for (const insert of all_selection_history_inserts) {
          const key = `${insert.source_id}_${insert.source_market_id}_${insert.source_selection_id}_${insert.timestamp}`
          unique_selection_history_inserts.set(key, insert)
        }

        await batch_insert({
          items: [...unique_selection_history_inserts.values()],
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
      }

      if (all_selection_index_inserts.length > 0) {
        // Deduplicate selection index inserts by composite key
        const unique_selection_index_inserts = new Map()
        for (const insert of all_selection_index_inserts) {
          const key = `${insert.source_id}_${insert.source_market_id}_${insert.source_selection_id}_${insert.time_type}`
          unique_selection_index_inserts.set(key, insert)
        }

        await batch_insert({
          items: [...unique_selection_index_inserts.values()],
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
      }

      // Execute cleanup operations
      for (const cleanup_op of all_selection_cleanup_operations) {
        if (cleanup_op.source_market_id && cleanup_op.new_selection_ids) {
          // Get existing selections to find what needs cleanup
          const existing_selections = await db('prop_market_selections_index')
            .where({
              source_market_id: cleanup_op.source_market_id,
              time_type: 'CLOSE'
            })
            .select('source_selection_id')

          const existing_selection_ids = existing_selections.map(
            (s) => s.source_selection_id
          )
          const missing_selection_ids = existing_selection_ids.filter(
            (id) => !cleanup_op.new_selection_ids.includes(id)
          )

          if (missing_selection_ids.length > 0) {
            await db('prop_market_selections_index')
              .where({
                source_market_id: cleanup_op.source_market_id,
                time_type: 'CLOSE'
              })
              .whereIn('source_selection_id', missing_selection_ids)
              .del()
          }
        }
      }
    }
  })

  // Clear cache after processing
  clear_cache()
  log('Market insertion completed')
}
