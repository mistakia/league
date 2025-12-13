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
 * @param {Object} payload - Message payload
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
 * Validate required fields in a payload
 * @param {Object} payload - Payload to validate
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
 * @returns {Object} Error payload
 */
export function create_error_payload(error_message, context) {
  return {
    error: error_message,
    context,
    timestamp: new Date().toISOString()
  }
}
