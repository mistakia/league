import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { wait } from '#libs-server'
import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'

const log = debug('import-live-plays-worker')
debug.enable('import-live-plays-worker')

const LOOP_INTERVAL_MS = 60000 // 60 seconds between iterations
const ITERATION_TIMEOUT_MS = 300000 // 5 minutes max per iteration

// Use object to allow modification detection by linter
const state = { should_exit: false }

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

/**
 * Run a single import iteration with error handling
 * @returns {Promise<boolean>} - True if all games were skipped (no active games)
 */
const run_import_iteration = async () => {
  try {
    const result = await with_timeout(
      import_plays_nfl_v1({ ignore_cache: true }),
      ITERATION_TIMEOUT_MS
    )
    return result
  } catch (error) {
    log(`Import iteration error: ${error.message}`)
    return false // Continue loop on error
  }
}

/**
 * Main worker loop - runs continuously importing live plays
 */
const import_live_plays_worker = async () => {
  log('Starting live plays worker...')

  // Only run during regular season
  if (current_season.nfl_seas_type !== 'REG') {
    log(
      `Not in regular season (current: ${current_season.nfl_seas_type}), exiting worker`
    )
    return
  }

  setup_signal_handlers()

  let loop_count = 0
  let all_games_skipped = false

  while (!state.should_exit && !all_games_skipped) {
    const throttle_timer = wait(LOOP_INTERVAL_MS)

    loop_count += 1
    log(`Running import iteration ${loop_count}`)

    all_games_skipped = await run_import_iteration()

    if (all_games_skipped) {
      log(`All games completed or skipped after ${loop_count} iterations`)
    }

    // Wait for remaining throttle time unless we're exiting
    if (!state.should_exit && !all_games_skipped) {
      await throttle_timer
    }
  }

  log(
    `Worker exiting (should_exit: ${state.should_exit}, all_games_skipped: ${all_games_skipped})`
  )

  // Clean up database connection
  await db.destroy()
}

// Export for PM2
export default import_live_plays_worker

// Run if executed directly
if (process.argv[1].includes('import-live-plays-worker')) {
  import_live_plays_worker()
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
