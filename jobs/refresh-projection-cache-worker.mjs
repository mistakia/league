import debug from 'debug'

import db from '#db'
import { wait, report_run_outcome, is_main } from '#libs-server'
import { refresh_projection_caches } from '#libs-server/refresh-projection-caches.mjs'
import { create_logger } from '#libs-shared/log.mjs'
import { install_process_handlers } from '#libs-server/install-process-handlers.mjs'

const log = debug('refresh-projection-cache-worker')

// Same trap as the two live-import workers: an unconditional debug.enable()
// here would switch OFF whatever namespaces DEBUG had turned on, because under
// debug 4.4.3 a call made after the loggers exist can disable but not enable,
// and ESM has already evaluated every import by this point.
if (!process.env.DEBUG) {
  debug.enable('refresh-projection-cache-worker')
}

install_process_handlers({
  service_name: 'refresh-projection-cache-worker',
  logger: create_logger('refresh-projection-cache-worker:process', {
    service: 'refresh-projection-cache-worker'
  })
})

// Closes the window between a commissioner saving a scoring or roster setting
// -- which resolves a NEW opaque format id whose projection slice is empty --
// and the hourly process-projections cron rebuilding it. That work used to run
// synchronously inside the PUT, which put a full re-derivation in a request,
// reported the outcome under the CRON's job type, and answered 200 whether or
// not it succeeded.
//
// Nothing tells this worker what to do: refresh_projection_caches derives the
// work from an empty cache slice, which makes the pass idempotent, self-healing
// for a slice broken by anything else, and immune to the intermediate format
// ids a per-field PUT mints and abandons -- an id no season row references is
// never a candidate, so five rapid edits cost one rebuild rather than five.
const ACTIVE_POLL_INTERVAL_MS = 20_000
const IDLE_POLL_INTERVAL_MS = 5 * 60_000
const SHUTDOWN_CHECK_INTERVAL_MS = 10_000

const RUN_SOURCE = 'service:league-refresh-projection-cache-worker'

// Held across passes so a format that cannot be rebuilt is abandoned rather
// than retried every 20s for the life of the process.
const attempts_by_format_id = new Map()

const state = { should_exit: false }

const setup_signal_handlers = () => {
  const handle_signal = (signal) => {
    log(`received ${signal}, shutting down after the current pass`)
    state.should_exit = true
  }
  process.on('SIGTERM', () => handle_signal('SIGTERM'))
  process.on('SIGINT', () => handle_signal('SIGINT'))
}

const interruptible_wait = async (total_ms) => {
  const end = Date.now() + total_ms
  while (Date.now() < end && !state.should_exit) {
    await wait(Math.min(SHUTDOWN_CHECK_INTERVAL_MS, end - Date.now()))
  }
}

const main = async () => {
  setup_signal_handlers()
  log('refresh-projection-cache-worker started')

  while (!state.should_exit) {
    let did_work = false
    try {
      const { rebuilt, failures } = await refresh_projection_caches({
        db,
        attempts_by_format_id,
        should_stop: () => state.should_exit
      })
      did_work = rebuilt.length > 0 || failures.length > 0

      // Report only a pass that did something. A 20s poll reporting every idle
      // pass would put ~4300 rows a day into the ledger for a source whose
      // interesting events are rare, burying its own real outcomes.
      if (failures.length) {
        await report_run_outcome({
          source: RUN_SOURCE,
          outcome: 'failure',
          reason: failures.join('; ').slice(0, 500),
          exit_code: 1
        })
      } else if (rebuilt.length) {
        await report_run_outcome({
          source: RUN_SOURCE,
          outcome: 'success',
          reason: `rebuilt ${rebuilt.length} format slice(s)`,
          exit_code: 0
        })
      }
    } catch (err) {
      log(`pass failed: ${err.message}`)
      try {
        await report_run_outcome({
          source: RUN_SOURCE,
          outcome: 'failure',
          reason: err.message,
          exit_code: 1
        })
      } catch (report_err) {
        log(`run report failed: ${report_err.message}`)
      }
    }

    if (state.should_exit) break
    await interruptible_wait(
      did_work ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS
    )
  }

  log('refresh-projection-cache-worker stopped')
  await db.destroy()
  process.exit(0)
}

if (is_main(import.meta.url)) {
  main()
}

export default main
