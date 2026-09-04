import debug from 'debug'

const log = debug('websocket-utils')

/**
 * WebSocket utility functions shared across socket handlers
 */

/**
 * Generate a unique client ID for WebSocket tracking
 * @returns {string} Unique client identifier
 */
export function generate_client_id() {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * Send a message to a WebSocket client
 * Safely handles closed connections and errors
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} type - Message type
 * @param {object} payload - Message payload
 * @returns {boolean} True if message was sent, false otherwise
 */
export function send_websocket_message(ws, type, payload) {
  if (!ws) {
    log('Attempted to send message to null WebSocket')
    return false
  }

  if (ws.readyState !== 1) {
    // WebSocket.OPEN = 1
    log('WebSocket not open, cannot send message', {
      readyState: ws.readyState,
      client_id: ws.client_id
    })
    return false
  }

  try {
    ws.send(JSON.stringify({ type, payload }))
    return true
  } catch (error) {
    log('Error sending message to client:', error.message, {
      client_id: ws.client_id
    })
    return false
  }
}

/**
 * Register a WebSocket `message` listener whose failures cannot reach the
 * process.
 *
 * AN EVENTEMITTER DISCARDS WHAT ITS LISTENER RETURNS, so `ws.on('message',
 * async ...)` hands its promise to nobody: a rejection inside the body is an
 * unhandled rejection, and `install_process_handlers` exits on those. That is
 * not a theoretical shape. During the 2026-09-04 hosting cutover the database
 * was briefly unreachable, one AUCTION_JOIN frame per reconnect awaited a
 * round trip that rejected ECONNREFUSED, and the API died in a PM2 restart
 * loop -- so every route on the server went down, including the ones that
 * never touch Postgres, and the edge served 521.
 *
 * The blast radius is what this fixes. A frame whose handler fails should cost
 * that frame. Reproduced by pointing the pool at a closed port and sending one
 * frame; note a WRONG PASSWORD is a different failure mode and does not
 * exercise this path.
 *
 * THE LISTENER STILL RETURNS ITS PROMISE, now one that cannot reject. A real
 * EventEmitter discards it, which is the whole problem being fixed, but the
 * socket test fixtures drive the entry point directly and `await` the listener
 * to sequence a join before asserting on it. Returning nothing here left those
 * assertions running against a join that had not finished -- a wrapper that
 * silently de-sequenced its callers rather than one that merely caught.
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {(msg: any) => any} handler - sync or async frame handler
 * @param {string} [context] - label for the log line
 */
export function on_socket_message(ws, handler, context = 'socket') {
  ws.on('message', (msg) => {
    let result
    try {
      result = handler(msg)
    } catch (error) {
      log(`${context}: message handler threw`, {
        client_id: ws.client_id,
        error: error.toString()
      })
      return
    }

    if (result && typeof result.catch === 'function') {
      return result.catch((error) => {
        log(`${context}: message handler rejected`, {
          client_id: ws.client_id,
          error: error.toString()
        })
      })
    }

    return result
  })
}

/**
 * Validate required fields in a payload
 * @param {object} payload - Payload to validate
 * @param {string[]} required_fields - Array of required field names
 * @returns {{valid: boolean, missing: string[]}} Validation result
 */
export function validate_required_fields(payload, required_fields) {
  const missing = required_fields.filter((field) => !payload?.[field])
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Create a standardized error response payload
 * @param {string} error_message - Error message
 * @param {string} context - Error context/operation
 * @returns {object} Error payload
 */
export function create_error_payload(error_message, context) {
  return {
    error: error_message,
    context,
    timestamp: new Date().toISOString()
  }
}
