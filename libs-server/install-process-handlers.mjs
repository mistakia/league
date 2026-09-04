// Process-level uncaughtException and unhandledRejection handlers for the
// PM2-managed services (server.mjs and the jobs/*-worker.mjs entry points).
//
// Node's default for both events is to print the stack and exit non-zero.
// Registering a listener REPLACES that default, so these handlers reproduce it
// on purpose: stderr first, then a log_error signal, then a non-zero exit. A
// handler that only logs would leave a service whose loop promise died sitting
// "online" under PM2 forever, since autorestart only fires on process death.
//
// One class is exempt from the exit and reports instead -- a datastore that is
// unreachable at the syscall level. See UNREACHABLE_DATASTORE_CODES below for
// why, and for why the exemption is deliberately narrow.

const EXIT_CODE_UNHANDLED_ERROR = 1

// Datastore UNREACHABILITY is reported but not exited on, and this is the one
// carve-out in the exit-by-default rule above.
//
// The principle is the one the Redis adapter fix established: unreachability is
// not misconfiguration. A missing credential is a deployment mistake and should
// be loud and immediate; a refused connection is a condition that flaps, that
// no restart can fix, and that resolves on its own when the far end returns.
// Exiting on it makes the outage strictly worse -- PM2 restarts into the same
// unreachable database, burns its restart budget, and every route on the server
// goes down including the ones that never touch a database. Measured: the
// 2026-09-04 hosting cutover killed the API in a restart loop and served 521 at
// the edge while the app itself was fine.
//
// Narrow on purpose. Only these syscall-level connection errors are exempt; a
// query error, a constraint violation, a TypeError and every other unhandled
// rejection still exit, because those are bugs a restart may genuinely clear
// and because a process left alive in an undefined state is the failure this
// module was written to prevent. The signal is emitted either way, so an
// exempt error is never silent.
const UNREACHABLE_DATASTORE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE'
])

export const is_datastore_unreachable = (error) =>
  Boolean(
    error &&
    typeof error.syscall === 'string' &&
    UNREACHABLE_DATASTORE_CODES.has(error.code)
  )

export const install_process_handlers = ({ service_name, logger } = {}) => {
  if (!logger || typeof logger.error !== 'function') {
    throw new Error('install_process_handlers requires a logger with .error()')
  }

  const report_unhandled_error = async ({ error, kind }) => {
    const survivable = is_datastore_unreachable(error)
    try {
      // stderr unconditionally and first: logger.error returns null without
      // emitting anything whenever signal transport is unavailable (no
      // signals_api_url, no BASE_MACHINE_SLUG, missing instance key file), and
      // its own stderr warning is deduped once per process — so this write is
      // the only trace guaranteed to survive.
      process.stderr.write(
        `[${kind}]${survivable ? '[datastore_unreachable]' : ''} ${service_name}: ${error.stack || error}\n`
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

    if (survivable) return

    process.exit(EXIT_CODE_UNHANDLED_ERROR)
  }

  process.on('uncaughtException', (error) => {
    report_unhandled_error({ error, kind: 'uncaught' })
  })

  process.on('unhandledRejection', (reason) => {
    report_unhandled_error({
      error: reason instanceof Error ? reason : new Error(String(reason)),
      kind: 'unhandled_rejection'
    })
  })
}
