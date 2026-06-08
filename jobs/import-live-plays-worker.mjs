import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { wait, is_main } from '#libs-server'
import { create_logger } from '#libs-shared/log.mjs'
import { install_process_handlers } from '#libs-server/install-process-handlers.mjs'
import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'

const log = debug('import-live-plays-worker')
debug.enable('import-live-plays-worker')

install_process_handlers({
  service_name: 'import-live-plays-worker',
  logger: create_logger('import-live-plays-worker:process', {
    service: 'import-live-plays-worker'
  })
})

const LOOP_INTERVAL_MS = 60_000 // active games: 1 minute between iterations
const IDLE_INTERVAL_MS = 5 * 60_000 // REG season but no live games: 5 minutes
const OFFSEASON_INTERVAL_MS = 60 * 60_000 // not in REG season: 1 hour
const SHUTDOWN_CHECK_INTERVAL_MS = 30_000 // chunk size for interruptible sleep so SIGINT is honored within 30s
const ITERATION_TIMEOUT_MS = 300_000 // 5 minutes max per iteration

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

// Sleep that wakes early on SIGINT/SIGTERM so long offseason/idle sleeps do not
// delay shutdown. Polls state.should_exit every SHUTDOWN_CHECK_INTERVAL_MS.
const interruptible_wait = async (total_ms) => {
  const end = Date.now() + total_ms
  while (Date.now() < end && !state.should_exit) {
    const remaining = end - Date.now()
    await wait(Math.min(SHUTDOWN_CHECK_INTERVAL_MS, remaining))
  }
}

/**
 * Main worker loop - runs continuously, adapting sleep cadence to whether
 * we are in regular season and whether any games are currently live.
 *
 * The worker never exits voluntarily (it sleeps instead). This avoids fighting
 * pm2 autorestart and prevents the offseason restart-storm that previously
 * generated GB of log churn.
 */
const import_live_plays_worker = async () => {
  log('Starting live plays worker...')
  setup_signal_handlers()

  let loop_count = 0

  while (!state.should_exit) {
    if (current_season.nfl_seas_type !== 'REG') {
      log(
        `Not in regular season (current: ${current_season.nfl_seas_type}), sleeping ${OFFSEASON_INTERVAL_MS / 1000}s`
      )
      await interruptible_wait(OFFSEASON_INTERVAL_MS)
      continue
    }

    loop_count += 1
    log(`Running import iteration ${loop_count}`)
    const all_games_skipped = await run_import_iteration()
    if (state.should_exit) break

    const sleep_ms = all_games_skipped ? IDLE_INTERVAL_MS : LOOP_INTERVAL_MS
    if (all_games_skipped) {
      log(`No active games, sleeping ${sleep_ms / 1000}s`)
    }
    await interruptible_wait(sleep_ms)
  }

  log(`Worker exiting (should_exit: ${state.should_exit})`)
  await db.destroy()
}

// Export for PM2
export default import_live_plays_worker

// Run if executed directly OR via PM2
if (is_main(import.meta.url) || process.env.PM2_HOME) {
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
