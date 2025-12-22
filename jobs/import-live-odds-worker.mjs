import debug from 'debug'

import db from '#db'
import { wait } from '#libs-server'
import { job as import_draftkings_odds } from '#scripts/import-draftkings-odds.mjs'
import { job as import_pinnacle_odds } from '#scripts/import-pinnacle-odds.mjs'
import { job as import_prizepicks_odds } from '#scripts/import-prizepicks-odds.mjs'

const log = debug('import-live-odds-worker')
debug.enable('import-live-odds-worker')

// ============================================================================
// Configuration
// ============================================================================

// Per-bookmaker throttle intervals (in milliseconds)
const BOOKMAKER_CONFIG = {
  draftkings: {
    name: 'DraftKings',
    import_fn: import_draftkings_odds,
    interval_ms: 4 * 60 * 60 * 1000, // 4 hours
    enabled: true
  },
  pinnacle: {
    name: 'Pinnacle',
    import_fn: () => import_pinnacle_odds({ ignore_cache: true }),
    interval_ms: 4 * 60 * 60 * 1000, // 4 hours
    enabled: true
  },
  prizepicks: {
    name: 'PrizePicks',
    import_fn: import_prizepicks_odds,
    interval_ms: 4 * 60 * 60 * 1000, // 4 hours
    enabled: true
  }
}

// Main loop interval - determines how often we check if imports should run
const LOOP_INTERVAL_MS = 30000 // 30 seconds

// Timeout for individual import operations
const IMPORT_TIMEOUT_MS = 180000 // 3 minutes

// State tracking
const state = { should_exit: false }
const last_import_times = {}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an async function with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeout_ms - Timeout in milliseconds
 * @returns {Promise} - Resolves with result or rejects with timeout error
 */
const with_timeout = (promise, timeout_ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout_ms}ms`))
    }, timeout_ms)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

/**
 * Handle graceful shutdown
 */
const setup_signal_handlers = () => {
  const handle_signal = (signal) => {
    log(`Received ${signal}, initiating graceful shutdown...`)
    state.should_exit = true
  }

  process.on('SIGTERM', () => handle_signal('SIGTERM'))
  process.on('SIGINT', () => handle_signal('SIGINT'))
}

// ============================================================================
// Import Logic
// ============================================================================

/**
 * Check if a bookmaker import should run based on throttle interval
 * @param {string} bookmaker_key - The bookmaker configuration key
 * @returns {boolean} - True if the import should run
 */
const should_import = (bookmaker_key) => {
  const config = BOOKMAKER_CONFIG[bookmaker_key]
  if (!config || !config.enabled) {
    return false
  }

  const last_time = last_import_times[bookmaker_key] || 0
  const elapsed = Date.now() - last_time
  return elapsed >= config.interval_ms
}

/**
 * Import odds for a single bookmaker with error handling
 * @param {string} bookmaker_key - The bookmaker configuration key
 * @returns {Promise<boolean>} - True if import succeeded
 */
const import_bookmaker = async (bookmaker_key) => {
  const config = BOOKMAKER_CONFIG[bookmaker_key]
  if (!config) {
    return false
  }

  const start_time = Date.now()
  log(`Starting ${config.name} import...`)

  try {
    await with_timeout(config.import_fn(), IMPORT_TIMEOUT_MS)
    last_import_times[bookmaker_key] = Date.now()
    const duration = Date.now() - start_time
    log(`${config.name} import completed in ${duration}ms`)
    return true
  } catch (error) {
    const duration = Date.now() - start_time
    log(`${config.name} import failed after ${duration}ms: ${error.message}`)
    // Still update last import time to prevent hammering on repeated failures
    last_import_times[bookmaker_key] = Date.now()
    return false
  }
}

/**
 * Run a single loop iteration - check and import all due bookmakers
 * @returns {Promise<Object>} - Results of the iteration
 */
const run_import_iteration = async () => {
  const results = {
    imports_attempted: 0,
    imports_succeeded: 0,
    imports_failed: 0
  }

  for (const bookmaker_key of Object.keys(BOOKMAKER_CONFIG)) {
    if (state.should_exit) {
      break
    }

    if (should_import(bookmaker_key)) {
      results.imports_attempted++
      const success = await import_bookmaker(bookmaker_key)
      if (success) {
        results.imports_succeeded++
      } else {
        results.imports_failed++
      }
    }
  }

  return results
}

// ============================================================================
// Main Worker
// ============================================================================

/**
 * Main worker loop - runs continuously importing odds with per-bookmaker throttling
 */
const import_live_odds_worker = async () => {
  log('Starting live odds worker...')
  log(
    `Configured bookmakers: ${Object.keys(BOOKMAKER_CONFIG)
      .filter((k) => BOOKMAKER_CONFIG[k].enabled)
      .map(
        (k) =>
          `${BOOKMAKER_CONFIG[k].name} (${BOOKMAKER_CONFIG[k].interval_ms / 1000}s)`
      )
      .join(', ')}`
  )

  setup_signal_handlers()

  let loop_count = 0

  while (!state.should_exit) {
    const throttle_timer = wait(LOOP_INTERVAL_MS)

    loop_count += 1

    const results = await run_import_iteration()

    if (results.imports_attempted > 0) {
      log(
        `Iteration ${loop_count}: ${results.imports_succeeded}/${results.imports_attempted} imports succeeded`
      )
    }

    // Wait for remaining throttle time unless we're exiting
    if (!state.should_exit) {
      await throttle_timer
    }
  }

  log(`Worker exiting after ${loop_count} iterations`)

  // Clean up database connection
  await db.destroy()
}

// ============================================================================
// Entry Point
// ============================================================================

export default import_live_odds_worker

if (process.argv[1].includes('import-live-odds-worker')) {
  import_live_odds_worker()
    .then(() => {
      log('Worker finished')
      process.exit(0)
    })
    .catch((error) => {
      log(`Worker fatal error: ${error.message}`)
      console.error(error)
      process.exit(1)
    })
}
