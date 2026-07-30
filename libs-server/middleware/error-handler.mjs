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

    // A malformed / oversized / aborted request body is a client fault, not a
    // server defect. body-parser (via raw-body/http-errors) tags these with
    // `err.type` and sets `err.expose = true` for its 4xx conditions
    // (entity.parse.failed, entity.too.large, request.aborted,
    // encoding.unsupported, ...). The common case here is `request.aborted`:
    // the browser went away mid-POST while express.json() was still reading the
    // body, so the route handler never ran (signal #123611; the same fingerprint
    // was #121082/#121746 for base-api, guarded there in base 0320972a).
    // Respond with the parser's own 4xx but do not emit a log_error signal.
    // The `status < 500` and `expose === true` conjuncts keep genuine server
    // faults signalling: http-errors sets expose=false for 5xx, and a plain
    // Error has no `type` at all.
    const is_client_body_fault =
      typeof error?.type === 'string' && error?.expose === true && status < 500

    if (!is_malformed_uri && !is_client_body_fault) {
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
