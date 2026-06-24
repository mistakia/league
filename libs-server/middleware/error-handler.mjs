// Express error middleware that routes unhandled route errors through the
// per-repo logger wrapper as `severity: medium` log_error signals. Returns
// a sanitized JSON response to the client without leaking the stack or the
// raw error message for 5xx in production.

const IS_PROD = process.env.NODE_ENV === 'production'

export const create_error_handler = ({ logger }) => {
  if (!logger || typeof logger.error !== 'function') {
    throw new Error('create_error_handler requires a logger with .error()')
  }

  return (error, req, res, _next) => {
    const status = Number.isInteger(error?.status)
      ? error.status
      : Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 500

    // Malformed-URI decode failures surface here as URIError with status 400 —
    // e.g. express route param decoding of a percent-encoding a vulnerability
    // scanner sent (/cgi-bin/%%32%65%%32%65/.../bin/sh). These are benign
    // client/scanner noise, not a server fault, so respond 400 without emitting
    // a log_error signal (signal #115001 was exactly this; the request already
    // gets the correct 400, the only issue was the spurious error log).
    const is_malformed_uri = error?.name === 'URIError'

    if (!is_malformed_uri) {
      try {
        logger.error(error, {
          severity: status >= 500 ? 'medium' : 'low',
          context: {
            path: req?.path,
            method: req?.method,
            status,
            error_name: error?.name
          }
        })
      } catch (_emit_error) {
        // swallow; do not block the response
      }
    }

    if (res.headersSent) {
      return
    }

    // In production, suppress the raw error.message for 5xx to prevent
    // leaking internal paths, SQL fragments, or framework internals. 4xx
    // typically carry validation messages that are safe to surface.
    const client_message =
      IS_PROD && status >= 500
        ? 'Internal server error'
        : error?.message || 'Internal server error'

    res.status(status).send({ error: client_message })
  }
}
