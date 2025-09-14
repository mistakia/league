import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { constants } from '#libs-shared'
import {
  SettlementOrchestrator,
  PlayerGamelogHandler,
  NFLPlaysHandler,
  NFLGamesHandler,
  TeamStatsHandler,
  get_supported_market_types,
  HANDLER_TYPES
} from '#libs-server/prop-market-settlement/index.mjs'

const argv = yargs(hideBin(process.argv))
  .usage(
    '$0 [options]',
    'Process prop market results using the settlement system'
  )
  .option('year', {
    type: 'number',
    describe: 'Season year to process'
  })
  .option('week', {
    type: 'number',
    describe: 'Specific week to process (requires year)'
  })
  .option('missing_only', {
    type: 'boolean',
    default: false,
    describe: 'Only process markets missing a result'
  })
  .option('current_week_only', {
    type: 'boolean',
    default: false,
    describe: 'Only process current NFL week'
  })
  .option('batch_size', {
    type: 'number',
    default: 1000,
    describe: 'Market batch size (selections per calculator batch)'
  })
  .option('game_batch_size', {
    type: 'number',
    default: 25,
    describe: 'Number of games to prefetch/process per cycle'
  })
  .option('concurrency', {
    type: 'number',
    default: 2,
    describe: 'Concurrent games processed within a batch'
  })
  .option('dry_run', {
    type: 'boolean',
    default: false,
    describe: 'Preview DB updates without writing'
  })
  .example('$0 --missing_only', 'Process only markets without results')
  .example('$0 --current_week_only --dry_run', 'Preview current week results')
  .example(
    '$0 --year 2024 --week 5',
    'Process all markets for week 5 of 2024 season'
  )
  .help()
  .parse()
const log = debug('process-market-results-modular')
debug.enable('process-market-results-modular')

// utility: split an array into chunks
const chunk_array = (items, size) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

// utility: process items with a concurrency limit
const with_concurrency = async ({ items, concurrency, handler }) => {
  const results = new Array(items.length)
  let next_index = 0

  const run_next = async () => {
    const index = next_index++
    if (index >= items.length) return
    try {
      results[index] = await handler(items[index], index)
    } catch (error) {
      results[index] = { error }
    }
    return run_next()
  }

  const workers = []
  const worker_count = Math.max(1, Math.min(concurrency, items.length))
  for (let i = 0; i < worker_count; i++) workers.push(run_next())
  await Promise.all(workers)
  return results
}

const process_market_results = async ({
  year = constants.season.year,
  week,
  missing_only = false,
  current_week_only = false,
  batch_size = 1000,
  game_batch_size = 25,
  concurrency = 2,
  dry_run = false
} = {}) => {
  log('Initializing modular prop market result calculator')

  // Initialize the calculator orchestrator
  const orchestrator = new SettlementOrchestrator(db)

  // Register all calculators
  await orchestrator.register_calculator(
    HANDLER_TYPES.PLAYER_GAMELOG,
    new PlayerGamelogHandler(db)
  )
  await orchestrator.register_calculator(
    HANDLER_TYPES.NFL_PLAYS,
    new NFLPlaysHandler(db)
  )
  await orchestrator.register_calculator(
    HANDLER_TYPES.NFL_GAMES,
    new NFLGamesHandler(db)
  )
  await orchestrator.register_calculator(
    HANDLER_TYPES.TEAM_STATS,
    new TeamStatsHandler(db)
  )

  log('Handlers registered successfully')

  if (dry_run) {
    log('Running in dry_run mode: no database writes will be performed')
  }

  // Validate calculator health
  const health_results = await orchestrator.health_check(true)
  for (const health of health_results) {
    if (!health.healthy) {
      log(
        `Warning: Handler ${health.calculator_type} failed health check: ${health.error}`
      )
    } else {
      log(`Handler ${health.calculator_type} is healthy`)
    }
  }

  // Get supported market types
  const supported_market_types = get_supported_market_types()
  log(`Supporting ${supported_market_types.length} market types`)

  // Step 1: discover eligible games (esbids) in smaller, index-friendly queries
  const esbid_rows = await db('prop_markets_index')
    .select('esbid')
    .whereNotNull('esbid')
    .whereIn('market_type', supported_market_types)
    .where('year', year)
    .modify((qb) => {
      if (missing_only) qb.where('market_settled', false)
    })
    .groupBy('esbid')

  let eligible_esbids = esbid_rows.map((r) => r.esbid)
  log(
    `Discovered ${eligible_esbids.length} games with eligible markets in ${year}`
  )

  // Filter by game status/week without expensive joins
  if (current_week_only || week !== undefined) {
    const target_week =
      week !== undefined ? week : constants.season.nfl_seas_week
    const week_rows = await db('nfl_games')
      .select('esbid')
      .where('week', target_week)
      .andWhere('year', year)
      .andWhere('seas_type', constants.season.nfl_seas_type)
      .whereNotNull('status')
    const week_set = new Set(week_rows.map((r) => r.esbid))
    eligible_esbids = eligible_esbids.filter((e) => week_set.has(e))
    log(`Filtering to week ${target_week} games only`)
  } else {
    const status_rows = await db('nfl_games')
      .select('esbid')
      .where('year', year)
      .whereNotNull('status')
    const status_set = new Set(status_rows.map((r) => r.esbid))
    eligible_esbids = eligible_esbids.filter((e) => status_set.has(e))
  }

  if (eligible_esbids.length === 0) {
    log('No games eligible to process')
    return
  }

  log(`Eligible games after status/week filter: ${eligible_esbids.length}`)

  // helper to fetch markets for a single game esbid, avoiding large joins
  const fetch_markets_for_game = async ({ esbid }) => {
    return await db('prop_market_selections_index')
      .select(
        'prop_markets_index.esbid',
        'prop_markets_index.market_type',
        'prop_market_selections_index.selection_pid',
        'prop_market_selections_index.selection_metric_line',
        'prop_market_selections_index.selection_type',
        'prop_market_selections_index.source_id',
        'prop_market_selections_index.source_market_id',
        'prop_market_selections_index.source_selection_id'
      )
      .join('prop_markets_index', function () {
        this.on(
          'prop_markets_index.source_id',
          '=',
          'prop_market_selections_index.source_id'
        ).andOn(
          'prop_markets_index.source_market_id',
          '=',
          'prop_market_selections_index.source_market_id'
        )
      })
      .where('prop_markets_index.esbid', esbid)
      .andWhere('prop_markets_index.year', year)
      .whereIn('prop_markets_index.market_type', supported_market_types)
      .modify((qb) => {
        if (missing_only) qb.where('prop_markets_index.market_settled', false)
      })
  }

  // Process per game in batches with limited concurrency
  const game_batches = chunk_array(eligible_esbids, game_batch_size)
  log(
    `Processing ${game_batches.length} game batches of size ${game_batch_size} (concurrency ${concurrency})`
  )

  let processed_count = 0
  let error_count = 0
  const market_updates = new Map()
  const market_selection_counts = new Map() // Track total selections per market
  const market_processed_counts = new Map() // Track processed selections per market
  const selection_update_previews = []
  const market_update_previews = []

  for (const [game_batch_index, esbid_batch] of game_batches.entries()) {
    log(
      `Prefetching data for game batch ${game_batch_index + 1}/${game_batches.length}`
    )
    await orchestrator.prefetch_data_for_games(esbid_batch)

    // fetch markets for games in this batch with limited concurrency
    const market_lists = await with_concurrency({
      items: esbid_batch,
      concurrency,
      handler: async (esbid) => {
        try {
          const markets_for_game = await fetch_markets_for_game({ esbid })
          return { esbid, markets: markets_for_game }
        } catch (error) {
          log(`Error fetching markets for game ${esbid}: ${error.message}`)
          return { esbid, markets: [], error: error.message }
        }
      }
    })

    // process each game's markets in sub-batches
    for (const market_list of market_lists) {
      const markets = market_list?.markets || []
      if (markets.length === 0) continue

      // Track total selections per market for this batch
      for (const market of markets) {
        const market_key = `${market.source_id || 'unknown'}:${market.source_market_id || 'unknown'}`
        if (!market_selection_counts.has(market_key)) {
          market_selection_counts.set(market_key, 0)
        }
        market_selection_counts.set(
          market_key,
          market_selection_counts.get(market_key) + 1
        )
      }

      const selection_batches = chunk_array(markets, batch_size)
      for (const selection_batch of selection_batches) {
        try {
          const results =
            await orchestrator.batch_calculate_markets(selection_batch)
          for (const result of results) {
            try {
              if (result.error) {
                log(`Error in result: ${result.error}`)
                error_count++
                continue
              }

              const fallback = selection_batch.find(
                (m) =>
                  m.esbid === result.esbid &&
                  m.market_type === result.market_type &&
                  m.selection_pid === result.selection_pid
              )

              const where_clause = {
                source_id: result.source_id || fallback?.source_id,
                source_market_id:
                  result.source_market_id || fallback?.source_market_id,
                source_selection_id:
                  result.source_selection_id || fallback?.source_selection_id
              }

              const update_data = { selection_result: result.selection_result }

              if (dry_run) {
                selection_update_previews.push({
                  table: 'prop_market_selections_index',
                  where: where_clause,
                  update: update_data
                })
              } else {
                await db('prop_market_selections_index')
                  .where(where_clause)
                  .update(update_data)
              }

              const market_key = `${where_clause.source_id || 'unknown'}:${where_clause.source_market_id || 'unknown'}`

              // Track successful processing for this market
              if (!market_processed_counts.has(market_key)) {
                market_processed_counts.set(market_key, 0)
              }
              market_processed_counts.set(
                market_key,
                market_processed_counts.get(market_key) + 1
              )

              // Store or update market information
              if (!market_updates.has(market_key)) {
                const market_info = fallback
                if (market_info) {
                  market_updates.set(market_key, {
                    source_id: market_info.source_id,
                    source_market_id: market_info.source_market_id,
                    metric_result_value: result.metric_value
                  })
                }
              }

              processed_count++
            } catch (error) {
              log(`Error processing individual result: ${error.message}`)
              error_count++
            }
          }
        } catch (error) {
          log(`Error processing selection batch: ${error.message}`)
          error_count += selection_batch.length
        }
      }
    }

    // Log progress after each game batch
    log(
      `Progress: game batches ${game_batch_index + 1}/${game_batches.length} completed`
    )
    log(
      `Processed selections so far: ${processed_count}, Errors: ${error_count}`
    )
  }

  // Update market-level results
  log('Updating market-level results')
  let market_updates_count = 0

  for (const [market_key, market_update] of market_updates) {
    try {
      const where_clause = {
        source_id: market_update.source_id,
        source_market_id: market_update.source_market_id
      }

      // Determine if market should be settled based on selection processing
      const total_selections = market_selection_counts.get(market_key) || 0
      const processed_selections = market_processed_counts.get(market_key) || 0
      const market_settled =
        total_selections > 0 && total_selections === processed_selections

      if (market_settled) {
        log(
          `Market ${market_key}: ${processed_selections}/${total_selections} selections processed - marking as settled`
        )
      }

      const update_data = {
        market_settled,
        metric_result_value: market_update.metric_result_value
      }

      if (dry_run) {
        market_update_previews.push({
          table: 'prop_markets_index',
          where: where_clause,
          update: update_data
        })
      } else {
        await db('prop_markets_index').where(where_clause).update(update_data)
      }

      market_updates_count++
    } catch (error) {
      log(`Error updating market ${market_key}: ${error.message}`)
    }
  }

  // Log final statistics
  log('Processing completed')
  log(`Total selections processed: ${processed_count}`)
  log(`Total errors: ${error_count}`)
  log(`Markets updated: ${market_updates_count}`)

  // Calculate settlement statistics
  let fully_settled_count = 0
  let partially_settled_count = 0
  for (const market_key of market_updates.keys()) {
    const total_selections = market_selection_counts.get(market_key) || 0
    const processed_selections = market_processed_counts.get(market_key) || 0
    if (total_selections > 0) {
      if (total_selections === processed_selections) {
        fully_settled_count++
      } else if (processed_selections > 0) {
        partially_settled_count++
      }
    }
  }
  log(`Markets fully settled: ${fully_settled_count}`)
  log(`Markets partially settled: ${partially_settled_count}`)

  if (dry_run) {
    log(
      `dry_run summary: selection updates queued: ${selection_update_previews.length}`
    )
    log(
      `dry_run summary: market updates queued: ${market_update_previews.length}`
    )
    const preview_limit = 5
    if (selection_update_previews.length > 0) {
      log(
        `dry_run preview (first ${Math.min(preview_limit, selection_update_previews.length)}) selection updates:`
      )
      for (const preview of selection_update_previews.slice(0, preview_limit)) {
        log(preview)
      }
    }
    if (market_update_previews.length > 0) {
      log(
        `dry_run preview (first ${Math.min(preview_limit, market_update_previews.length)}) market updates:`
      )
      for (const preview of market_update_previews.slice(0, preview_limit)) {
        log(preview)
      }
    }
  }

  // Get calculator cache statistics
  const coverage = orchestrator.get_calculator_coverage()
  for (const [calculator_type, info] of Object.entries(coverage)) {
    if (info.registered) {
      const calculator = orchestrator.calculators.get(calculator_type)
      if (calculator && calculator.get_cache_stats) {
        const stats = calculator.get_cache_stats()
        log(`${calculator_type} cache stats:`, stats)
      }
    }
  }
}

const main = async () => {
  let error
  try {
    await process_market_results({
      year: argv.year,
      week: argv.week,
      missing_only: argv.missing_only,
      current_week_only: argv.current_week_only,
      batch_size: argv.batch_size || 1000,
      dry_run: argv.dry_run
    })
  } catch (err) {
    error = err
    log(error)
  }

  if (!argv.dry_run) {
    await report_job({
      job_type: job_types.PROCESS_MARKET_RESULTS,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_market_results
