import debug from 'debug'
import diff from 'deep-diff'

import db from '#db'
import insert_prop_market_selections from './insert-prop-market-selections.mjs'
import batch_insert from './batch-insert.mjs'
import {
  prefetch_existing_markets,
  prefetch_existing_selections,
  get_cached_market_latest,
  get_cached_market_before_observed_at,
  clear_cache,
  get_cache_stats
} from './betting-market-cache.mjs'
import {
  build_market_key,
  build_market_index_key,
  build_market_history_key,
  build_selection_index_key,
  build_selection_history_key
} from './betting-market-keys.mjs'
import emit_signal from './emit-signal.mjs'

const log = debug('insert-prop-markets')

// Batch sizes are bounded by Postgres's 65,535 bind parameters per statement,
// which for an upsert is rows x columns. prop_markets_index has 14 columns and
// prop_market_selections_index has 33 (the widest of the four tables, and so the
// binding constraint), giving 7,000 and 33,000 parameters at the sizes below --
// roughly half the ceiling, which leaves room for the tables to grow columns
// without a silent approach to the limit.
//
// The previous 100/500 pair was not merely conservative, it FRAGMENTED the
// selection chunks. An in-season DRAFTKINGS observation is about 2,417 markets
// and 9,003 selections, or 3.7 selections per market, so a 100-market batch
// produced ~372 selections -- under the chunk size, so every selection statement
// ran partial and 25 of them carried what 19 full ones would. At 500 markets a
// batch carries ~1,860 selections, which fills chunks instead of fragmenting
// them, and it cuts the per-batch market statement and the cleanup SELECT from
// 25 apiece to 5.
const MARKET_BATCH_SIZE = 500
const SELECTION_BATCH_SIZE = 1000

// Chunks within one phase upsert disjoint key sets -- the deduplicate_inserts
// pass above guarantees it -- so they may overlap without deadlocking against
// each other. Concurrency stays WITHIN a phase and never spans the index/history
// boundary, which is the ordering the correctness argument below rests on.
const SELECTION_INSERT_CONCURRENCY = 4

// Fields that trigger a history insert when changed
const MARKET_HISTORY_UPDATE_FIELDS = [
  'open',
  'selection_count',
  'live',
  'source_market_name'
]

// Fields that trigger an index update when changed
const MARKET_INDEX_UPDATE_FIELDS = ['esbid', 'season_year']

// Deduplicate inserts by generating a unique key for each record
const deduplicate_inserts = (inserts, get_key) => {
  const unique = new Map()
  for (const insert of inserts) {
    unique.set(get_key(insert), insert)
  }
  return [...unique.values()]
}

// Clean up stale selections that are no longer in the current market snapshot.
//
// Every query here is scoped by source_id. Betting sources reuse each other's
// source_market_id strings (33 are shared between DRAFTKINGS and FANATICS in
// production), so a reaper keyed on the market id alone treats another book's
// rows as stale and deletes them.
//
// Returns { deleted_count, violations }. A violation is a row the database
// reported deleted whose source_id is not the book the delete was scoped to --
// structurally impossible while the source_id predicate is present, and
// therefore the oracle that fires if it is ever dropped again.
export const cleanup_stale_selections = async (cleanup_operations) => {
  const result = { deleted_count: 0, violations: [] }

  if (cleanup_operations.length === 0) {
    return result
  }

  // Group valid selection ids per (source_id, source_market_id), merging
  // duplicate operations for the same market.
  const valid_selections_by_market = new Map()
  const market_ids_by_source = new Map()
  for (const op of cleanup_operations) {
    if (!op.source_id || !op.source_market_id || !op.new_selection_ids) {
      continue
    }

    const market_key = build_market_key(op)
    const existing_set = valid_selections_by_market.get(market_key)
    if (existing_set) {
      for (const id of op.new_selection_ids) {
        existing_set.add(id)
      }
    } else {
      valid_selections_by_market.set(market_key, new Set(op.new_selection_ids))
    }

    if (!market_ids_by_source.has(op.source_id)) {
      market_ids_by_source.set(op.source_id, new Set())
    }
    market_ids_by_source.get(op.source_id).add(op.source_market_id)
  }

  if (market_ids_by_source.size === 0) {
    return result
  }

  // One scoped query per book. Imports are per-book, so this is normally a
  // single query, preserving the previous batch shape.
  const delete_targets = new Map()
  for (const [source_id, market_ids] of market_ids_by_source.entries()) {
    const existing_selections = await db('prop_market_selections_index')
      .where('source_id', source_id)
      .whereIn('source_market_id', [...market_ids])
      .where('time_type', 'CLOSE')
      .select('source_id', 'source_market_id', 'source_selection_id')

    for (const selection of existing_selections) {
      const valid_ids = valid_selections_by_market.get(
        build_market_key(selection)
      )
      if (!valid_ids || valid_ids.has(String(selection.source_selection_id))) {
        continue
      }

      const market_key = build_market_key(selection)
      if (!delete_targets.has(market_key)) {
        delete_targets.set(market_key, {
          source_id: selection.source_id,
          source_market_id: selection.source_market_id,
          selection_ids: []
        })
      }
      delete_targets
        .get(market_key)
        .selection_ids.push(selection.source_selection_id)
    }
  }

  if (delete_targets.size === 0) {
    return result
  }

  const deleted_rows_per_target = await Promise.all(
    [...delete_targets.values()].map(
      ({ source_id, source_market_id, selection_ids }) =>
        db('prop_market_selections_index')
          .where({ source_id, source_market_id, time_type: 'CLOSE' })
          .whereIn('source_selection_id', selection_ids)
          .del()
          .returning(['source_id', 'source_market_id', 'source_selection_id'])
    )
  )

  const targets = [...delete_targets.values()]
  for (let i = 0; i < deleted_rows_per_target.length; i++) {
    const deleted_rows = deleted_rows_per_target[i]
    result.deleted_count += deleted_rows.length
    for (const row of deleted_rows) {
      if (row.source_id !== targets[i].source_id) {
        result.violations.push({
          scoped_source_id: targets[i].source_id,
          deleted_source_id: row.source_id,
          source_market_id: row.source_market_id,
          source_selection_id: row.source_selection_id
        })
      }
    }
  }

  return result
}

// Extract fields needed for market history inserts
const get_market_history_record = (market, observed_at) => ({
  source_id: market.source_id,
  source_market_id: market.source_market_id,
  source_market_name: market.source_market_name,
  open: market.open,
  live: market.live,
  selection_count: market.selection_count,
  observed_at
})

const process_market = async ({ observed_at, selections, ...market }) => {
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
    market_history_inserts.push(get_market_history_record(market, observed_at))

    market_index_inserts.push({
      ...market,
      observed_at,
      time_type: 'OPEN'
    })

    if (!market.live) {
      market_index_inserts.push({
        ...market,
        observed_at,
        time_type: 'CLOSE'
      })
    }
  } else {
    // Existing market - find the version before this observed_at for comparison
    const previous_market_row = get_cached_market_before_observed_at({
      source_id,
      source_market_id,
      observed_at
    })

    if (!previous_market_row) {
      // No market existed before this observed_at - insert as new history entry
      market_history_inserts.push(
        get_market_history_record(market, observed_at)
      )
    } else {
      // Create a copy for comparison to avoid mutating cached object
      const { observed_at: _, ...market_to_compare } = previous_market_row
      market_to_compare.open = Boolean(market_to_compare.open)
      market_to_compare.live = Boolean(market_to_compare.live)

      const differences = diff(market_to_compare, market)

      if (differences && differences.length) {
        const should_update_history = differences.some((d) =>
          MARKET_HISTORY_UPDATE_FIELDS.includes(d.path[0])
        )

        if (should_update_history) {
          market_history_inserts.push(
            get_market_history_record(market, observed_at)
          )
        }

        const should_update_index = differences.some((d) =>
          MARKET_INDEX_UPDATE_FIELDS.includes(d.path[0])
        )

        if (should_update_index) {
          market_index_inserts.push({
            ...market,
            observed_at,
            time_type: 'OPEN'
          })
          market_index_inserts.push({
            ...market,
            observed_at,
            time_type: 'CLOSE'
          })
        }
      }

      // Use the previous row for selection lookup since it wasn't mutated
      market_for_selection_lookup = previous_market_row
    }

    // Update CLOSE index if this is newer than existing and not live
    if (!market.live && observed_at > existing_market.observed_at) {
      market_index_inserts.push({
        ...market,
        observed_at,
        time_type: 'CLOSE'
      })
    }
  }

  // Process selections and get their operations
  const selection_operations = await insert_prop_market_selections({
    observed_at,
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
    cleanup_operations: 0,
    selection_deletes: 0,
    market_processing_failures: 0,
    selection_processing_failures: 0
  }

  // A market or selection that throws is skipped, not retried, and the run still
  // exits 0 -- so without an oracle distinct from the exit code the loss is
  // invisible. It is not merely a dropped row either: a market that never
  // reaches the insert leaves prop_markets_history sparse at this observed_at,
  // and while the VALUE self-heals (the baseline stays stale, so the next run
  // re-detects and writes at a new observed_at), the original observation
  // timestamp is gone and an excursion that reverts inside one run interval is
  // gone with it. Counting and signalling is the proportionate response; making
  // the batch atomic would not recover the timestamp either.
  const failure_samples = []

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

            const selection_failures =
              operations.selection_operations.failures || []
            stats.selection_processing_failures += selection_failures.length
            for (const failure of selection_failures) {
              if (failure_samples.length < 20) {
                failure_samples.push({ scope: 'selection', ...failure })
              }
            }
          }
        } else {
          log('Error processing market:', market_batch[i])
          log(result.reason)

          stats.market_processing_failures++
          if (failure_samples.length < 20) {
            failure_samples.push({
              scope: 'market',
              source_id: market_batch[i]?.source_id,
              source_market_id: market_batch[i]?.source_market_id,
              error: result.reason?.message || String(result.reason)
            })
          }
        }
      }

      // Deduplicate all inserts to avoid constraint violations
      const unique_market_history = deduplicate_inserts(
        all_market_history_inserts,
        build_market_history_key
      )

      const unique_market_index = deduplicate_inserts(
        all_market_index_inserts,
        build_market_index_key
      )

      const unique_selection_history = deduplicate_inserts(
        all_selection_history_inserts,
        build_selection_history_key
      )

      const unique_selection_index = deduplicate_inserts(
        all_selection_index_inserts,
        build_selection_index_key
      )

      // Accumulate stats
      stats.market_history_inserts += unique_market_history.length
      stats.market_index_inserts += unique_market_index.length
      stats.selection_history_inserts += unique_selection_history.length
      stats.selection_index_inserts += unique_selection_index.length
      stats.cleanup_operations += all_selection_cleanup_operations.length

      // Skip actual DB operations in dry run mode
      if (!dry_run) {
        // Index rows must be durable BEFORE history rows, and these four
        // statements are not in one transaction. Change detection is baselined
        // on the HISTORY tables (betting-market-cache.mjs prefetches
        // prop_markets_history / prop_market_selections_history), so a history
        // row that commits while its index row does not advances the baseline:
        // the next run diffs clean, never re-emits the index row, and the index
        // stays stale indefinitely. Only the OPEN rows are exposed -- the CLOSE
        // rows are rewritten unconditionally every run -- which makes the
        // damage rare but permanent.
        //
        // Ordering fixes it without a transaction. A failure anywhere after the
        // index phase leaves the baseline behind, so the next run re-detects
        // the change and rewrites both. Two round trips per batch instead of
        // one; a per-batch transaction would serialize all four onto a single
        // connection and cost six.
        //
        // Re-examined 2026-08-03 and kept, on a stronger argument than the
        // round-trip count: a transaction would not buy what it looks like it
        // buys. These four statements are not the whole unit -- the cache
        // prefetch happened before them and cleanup_stale_selections issues its
        // own DELETEs after -- and a crash BETWEEN batches is still possible
        // whatever a batch does internally. So the self-healing property has to
        // hold regardless, and once it holds the transaction is paying four
        // extra round trips per batch to make a guarantee the design already
        // has.
        const index_promises = []

        if (unique_market_index.length > 0) {
          index_promises.push(
            db('prop_markets_index')
              .insert(unique_market_index)
              .onConflict(['source_id', 'source_market_id', 'time_type'])
              .merge()
          )
        }

        if (unique_selection_index.length > 0) {
          index_promises.push(
            batch_insert({
              items: unique_selection_index,
              batch_size: SELECTION_BATCH_SIZE,
              concurrency: SELECTION_INSERT_CONCURRENCY,
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

        await Promise.all(index_promises)

        const history_promises = []

        if (unique_market_history.length > 0) {
          history_promises.push(
            db('prop_markets_history')
              .insert(unique_market_history)
              .onConflict(['source_id', 'source_market_id', 'observed_at'])
              .merge()
          )
        }

        if (unique_selection_history.length > 0) {
          history_promises.push(
            batch_insert({
              items: unique_selection_history,
              batch_size: SELECTION_BATCH_SIZE,
              concurrency: SELECTION_INSERT_CONCURRENCY,
              save: async (selection_batch) => {
                await db('prop_market_selections_history')
                  .insert(selection_batch)
                  .onConflict([
                    'source_id',
                    'source_market_id',
                    'source_selection_id',
                    'observed_at'
                  ])
                  .merge()
              }
            })
          )
        }

        await Promise.all(history_promises)

        // Clean up stale selections
        const cleanup_result = await cleanup_stale_selections(
          all_selection_cleanup_operations
        )
        stats.selection_deletes += cleanup_result.deleted_count

        // The reaper deleted 5.3M rows over its lifetime with nothing reporting
        // a single one. Surface the count, and signal if a delete ever escaped
        // the book it was scoped to.
        if (cleanup_result.violations.length > 0) {
          await emit_signal({
            source: 'libs-server/insert-prop-markets.mjs',
            kind: 'data_integrity',
            severity: 'high',
            title: `prop selection reaper deleted ${cleanup_result.violations.length} row(s) outside the emitting book`,
            payload: {
              deleted_count: cleanup_result.deleted_count,
              violations: cleanup_result.violations.slice(0, 20)
            },
            dedup_key: 'prop-selection-reaper:cross-book-delete'
          })
        }
      }

      const batch_duration = ((Date.now() - batch_start) / 1000).toFixed(2)
      log(
        `Batch ${batch_count}/${total_batches} completed in ${batch_duration}s (${market_batch.length} markets, ${unique_selection_history.length} selection inserts, ${stats.selection_deletes} cumulative selection deletes)`
      )
    }
  })

  // Clear cache after processing
  clear_cache()
  const total_duration = ((Date.now() - total_start) / 1000).toFixed(2)

  const total_failures =
    stats.market_processing_failures + stats.selection_processing_failures

  if (total_failures > 0 && !dry_run) {
    log(
      `${stats.market_processing_failures} market(s) and ${stats.selection_processing_failures} selection(s) failed to process`
    )

    await emit_signal({
      source: 'libs-server/insert-prop-markets.mjs',
      kind: 'data_integrity',
      // A handful of malformed selections from a book is routine noise; losing
      // whole markets means an observation is missing from history for every
      // market in the failing set, so it escalates.
      severity: stats.market_processing_failures > 0 ? 'high' : 'low',
      title: `prop market import dropped ${stats.market_processing_failures} market(s) and ${stats.selection_processing_failures} selection(s)`,
      payload: {
        total_markets: stats.total_markets,
        market_processing_failures: stats.market_processing_failures,
        selection_processing_failures: stats.selection_processing_failures,
        samples: failure_samples
      },
      dedup_key: 'prop-market-import:processing-failures'
    })
  }

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
    log(
      `Market insertion completed in ${total_duration}s (${stats.selection_deletes} stale selections deleted)`
    )
  }

  return { stats }
}
