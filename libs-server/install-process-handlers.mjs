// Process-level uncaughtException and unhandledRejection handlers that
// route through the per-repo logger wrapper. Every PM2-managed service
// installs these so unhandled errors emit a log_error signal before the
// process exits (or recovers, depending on caller behavior).

export const install_process_handlers = ({
  service_name,
  logger,
  on_uncaught,
  on_unhandled_rejection
} = {}) => {
  if (!logger || typeof logger.error !== 'function') {
    throw new Error('install_process_handlers requires a logger with .error()')
  }

  const uncaught_handler = (error) => {
    try {
      logger.error(error, {
        severity: 'high',
        context: { service: service_name || logger.service, kind: 'uncaught' }
      })
    } catch (_emit_error) {
      // swallow
    }
    if (typeof on_uncaught === 'function') on_uncaught(error)
  }

  const rejection_handler = (reason) => {
    const error_value =
      reason instanceof Error ? reason : new Error(String(reason))
    try {
      logger.error(error_value, {
        severity: 'high',
        context: {
          service: service_name || logger.service,
          kind: 'unhandled_rejection'
        }
      })
    } catch (_emit_error) {
      // swallow
    }
    if (typeof on_unhandled_rejection === 'function') {
      on_unhandled_rejection(reason)
    }
  }

  process.on('uncaughtException', uncaught_handler)
  process.on('unhandledRejection', rejection_handler)

  return () => {
    process.off('uncaughtException', uncaught_handler)
    process.off('unhandledRejection', rejection_handler)
  }
}
