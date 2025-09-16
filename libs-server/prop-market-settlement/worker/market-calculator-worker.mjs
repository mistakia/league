/**
 * Simplified worker thread for parallel market calculation processing
 *
 * This worker receives batches of markets and preloaded data from the main thread,
 * processes them using data-only handlers without any database connections,
 * and returns results.
 */

import { parentPort, workerData } from 'worker_threads'
import debug from 'debug'

import { SettlementOrchestrator, HANDLER_TYPES } from '../index.mjs'
import {
  PlayerGamelogMarketHandler,
  NFLPlaysMarketHandler,
  NFLGamesMarketHandler
} from './market-data-handlers.mjs'

const { worker_id, verbose, preloaded_data } = workerData
const log = verbose ? debug(`worker-${worker_id}`) : () => {}

// Initialize orchestrator once per worker for efficiency
let orchestrator = null
let initialized = false

/**
 * Initialize the settlement orchestrator with data-only handlers
 */
const initialize_worker = async () => {
  if (initialized) return

  log(`Worker ${worker_id}: Initializing with preloaded data`)

  // Create orchestrator without database connection
  orchestrator = new SettlementOrchestrator()

  // Register market data handlers that work exclusively with preloaded data
  await orchestrator.register_calculator(
    HANDLER_TYPES.PLAYER_GAMELOG,
    new PlayerGamelogMarketHandler(preloaded_data.player_gamelogs)
  )
  await orchestrator.register_calculator(
    HANDLER_TYPES.NFL_PLAYS,
    new NFLPlaysMarketHandler(preloaded_data.nfl_plays)
  )
  await orchestrator.register_calculator(
    HANDLER_TYPES.NFL_GAMES,
    new NFLGamesMarketHandler(preloaded_data.nfl_games)
  )

  initialized = true
  log(`Worker ${worker_id}: Initialization complete`)
}

/**
 * Process a batch of markets using preloaded data
 */
const process_market_batch = async (markets) => {
  try {
    await initialize_worker()

    log(`Worker ${worker_id}: Processing batch with ${markets.length} markets`)

    const start_time = Date.now()
    const results = await orchestrator.batch_calculate_markets(markets)
    const duration = Date.now() - start_time

    const successful = results.filter(
      (r) => !r.error && r.selection_result !== null
    ).length
    const errors = results.length - successful

    log(
      `Worker ${worker_id}: Completed ${results.length} calculations in ${duration}ms (${successful} successful, ${errors} errors)`
    )

    return results
  } catch (error) {
    log(`Worker ${worker_id}: Error processing batch: ${error.message}`)
    throw error
  }
}

/**
 * Handle messages from main thread
 */
parentPort.on('message', async (message) => {
  const { task_id, markets } = message

  try {
    const results = await process_market_batch(markets)
    parentPort.postMessage(results)
  } catch (error) {
    parentPort.postMessage({
      error: error.message,
      task_id
    })
  }
})
