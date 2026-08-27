// Process-level uncaughtException and unhandledRejection handlers for the
// PM2-managed services (server.mjs and the jobs/*-worker.mjs entry points).
//
// Node's default for both events is to print the stack and exit non-zero.
// Registering a listener REPLACES that default, so these handlers reproduce it
// on purpose: stderr first, then a log_error signal, then a non-zero exit. A
// handler that only logs would leave a service whose loop promise died sitting
// "online" under PM2 forever, since autorestart only fires on process death.

const EXIT_CODE_UNHANDLED_ERROR = 1

export const install_process_handlers = ({ service_name, logger } = {}) => {
  if (!logger || typeof logger.error !== 'function') {
    throw new Error('install_process_handlers requires a logger with .error()')
  }

  const report_and_exit = async ({ error, kind }) => {
    try {
      // stderr unconditionally and first: logger.error returns null without
      // emitting anything whenever signal transport is unavailable (no
      // signals_api_url, no BASE_MACHINE_SLUG, missing instance key file), and
      // its own stderr warning is deduped once per process — so this write is
      // the only trace guaranteed to survive.
      process.stderr.write(
        `[${kind}] ${service_name}: ${error.stack || error}\n`
      )

      const emission = logger.error(error, {
        severity: 'high',
        context: { service: service_name, kind }
      })

      // The signal POST is fire-and-forget; exiting without awaiting it drops
      // it. The transport carries its own 5s timeout, so this cannot hold the
      // process open indefinitely.
      if (emission) await emission.promise
    } catch (_report_error) {
      // The stack is already on stderr above. Reporting must never keep a
      // process alive in an undefined state.
    }

    process.exit(EXIT_CODE_UNHANDLED_ERROR)
  }

  process.on('uncaughtException', (error) => {
    report_and_exit({ error, kind: 'uncaught' })
  })

  process.on('unhandledRejection', (reason) => {
    report_and_exit({
      error: reason instanceof Error ? reason : new Error(String(reason)),
      kind: 'unhandled_rejection'
    })
  })
}
