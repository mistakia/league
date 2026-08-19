import crypto from 'crypto'
import { redis_cache } from '#libs-server'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import {
  execute_data_view_request,
  log_data_view_telemetry
} from '#libs-server/data-views/execute-data-view-request.mjs'
import debug from 'debug'
import { generate_client_id, send_websocket_message } from './utils.mjs'

const log = debug('data-view-socket')

// Per-socket execution tracking. `request_id` is the VIEW id, not a per-request
// identity, so executions are keyed on the server-minted `execution_id`; the
// client echoes it in DATA_VIEW_CLIENT_TIMING and the server validates it
// against this map. That kills cross-client forgery (a forged id is not in this
// socket's set) and the same-view-same-client ambiguity (each request gets a
// fresh id). Entries survive the terminal frame so the timing frame -- which
// arrives one round trip later -- can still be correlated.
const socket_executions = new WeakMap()

const get_executions = (ws) => {
  let executions = socket_executions.get(ws)
  if (!executions) {
    executions = new Map()
    socket_executions.set(ws, executions)
  }
  return executions
}

// A client timing frame must arrive within a second or two of the terminal
// frame; anything older than this retention window is unattributable and pruned.
const TIMING_RETENTION_MS = 60 * 1000

const prune_stale_executions = (executions) => {
  const now = Date.now()
  for (const [id, exec] of executions) {
    if (exec.state === 'done' && now - exec.started_at > TIMING_RETENTION_MS) {
      executions.delete(id)
    }
  }
}

export const handle_data_view_request = async ({
  ws,
  user_id,
  request_id,
  params,
  ignore_cache,
  cache_get = (key) => redis_cache.get(key)
}) => {
  const executions = get_executions(ws)
  prune_stale_executions(executions)

  // At most one live request per socket. A second request supersedes the first:
  // a queued waiter is aborted; an in-flight execution finishes bounded by its
  // timeout, writes the cache, and its result is not delivered. The client's
  // reconnect replay re-requests on the fresh socket, so aborting on supersede
  // is the same path as aborting on disconnect.
  for (const [id, exec] of executions) {
    if (exec.state === 'waiting' || exec.state === 'executing') {
      exec.controller.abort()
      exec.state = 'superseded'
      executions.delete(id)
    }
  }

  // Minted at REQUEST ENTRY, before the cache lookup -- not at admission. A
  // cache hit never enters the queue, so a late-minted id would leave every
  // cache-hit result frame without one, and the client suppresses an
  // unattributable timing frame, silently deleting the fast-path denominator
  // the no-floor contract protects.
  const execution_id = crypto.randomBytes(8).toString('hex')
  const controller = new AbortController()
  const exec = {
    request_id,
    execution_id,
    state: 'waiting',
    controller,
    started_at: Date.now()
  }
  executions.set(execution_id, exec)

  const cache_key = `/data-views/${get_data_view_hash({
    ...params,
    user_id: user_id || null
  })}`

  try {
    const cached_value = await cache_get(cache_key)
    if (cached_value && !ignore_cache) {
      // The cache value is the canonical { data_view_results, data_view_metadata }
      // object; tolerate a legacy bare-array entry (older builds cached raw rows
      // under this same key) so a shape mismatch can never surface as
      // result: undefined and crash the render.
      const normalized = Array.isArray(cached_value)
        ? { data_view_results: cached_value, data_view_metadata: {} }
        : cached_value
      send_websocket_message(ws, 'DATA_VIEW_RESULT', {
        request_id,
        execution_id,
        result: normalized.data_view_results,
        metadata: normalized.data_view_metadata,
        append_results: params.append_results
      })
      exec.state = 'done'
      return
    }

    const on_heartbeat = (payload) =>
      send_websocket_message(ws, 'DATA_VIEW_HEARTBEAT', payload)
    const on_status = (payload) =>
      send_websocket_message(ws, 'DATA_VIEW_STATUS', payload)

    const result = await execute_data_view_request({
      request_id,
      execution_id,
      params,
      user_id,
      path: 'socket',
      cache_key,
      signal: controller.signal,
      on_heartbeat,
      on_status
    })

    // A result for an execution that was superseded while running is discarded
    // with a record -- the exact gap the handoff found (a completed query whose
    // requester moved on was thrown away silently).
    if (executions.get(execution_id) !== exec) {
      log_data_view_telemetry({
        event: 'execution',
        execution_id,
        request_id,
        path: 'socket',
        outcome: 'discarded'
      })
      return
    }

    send_websocket_message(ws, 'DATA_VIEW_RESULT', {
      request_id,
      execution_id,
      result: result.data_view_results || [],
      metadata: result.data_view_metadata,
      append_results: params.append_results
    })
    exec.state = 'done'
  } catch (error) {
    if (error.code === 'ABORTED') {
      // Superseded or disconnected while waiting -- the client has moved on and
      // no error frame is due.
      return
    }
    if (executions.get(execution_id) !== exec) return
    log('Error processing request', { request_id, error: error.toString() })
    send_websocket_message(ws, 'DATA_VIEW_ERROR', {
      request_id,
      execution_id,
      error: error.toString()
    })
    exec.state = 'done'
  }
}

// The client reports only what the server cannot observe: when the answer
// actually reached the browser. The frame is unauthenticated and the value is
// client-supplied, so it is treated as untrusted end to end: clamped, labelled
// client-reported, and never allowed near the severity ladder or the slow-query
// dedup key. The poisoning target is the percentile, and the clamp bounds it.
export const handle_client_timing = ({ ws, payload }) => {
  const { request_id, execution_id, client_duration_ms, outcome } =
    payload || {}
  const exec = execution_id ? get_executions(ws).get(execution_id) : null
  if (!exec) {
    // Unknown execution for this socket: a forged id from another client, or a
    // pruned one. Dropping it is what makes cross-client forgery inert.
    log('dropped client timing frame for unknown execution', {
      request_id,
      execution_id
    })
    return null
  }

  // client_duration_ms is untrusted (anonymous, client-supplied): clamped,
  // labelled client-reported, and kept out of the severity ladder and the
  // slow-query dedup key. The poisoning target is the percentile; the clamp
  // bounds that too. Returns the telemetry entry for testability.
  const clamped = Number.isFinite(client_duration_ms)
    ? Math.max(0, Math.min(Math.round(client_duration_ms), 3600 * 1000))
    : null

  const entry = {
    event: 'client_timing',
    execution_id,
    request_id,
    client_duration_ms: clamped,
    outcome,
    client_reported: true
  }
  log_data_view_telemetry(entry)
  return entry
}

export default function handle_data_view_socket(wss) {
  wss.on('connection', function (ws, request) {
    const user_id = request.auth ? request.auth.userId : null
    ws.client_id = generate_client_id()
    log('New WebSocket connection', { client_id: ws.client_id, user_id })

    ws.on('message', async (msg) => {
      let message
      try {
        message = JSON.parse(msg)
      } catch (error) {
        log('Failed to parse message', { error: error.toString() })
        return
      }

      if (message.type === 'DATA_VIEW_REQUEST') {
        const { request_id, params, ignore_cache } = message.payload
        // handle_data_view_request catches internally and sends its own error
        // frame; this catch is only a final log for a failure before it could
        // (the socket layer itself throwing).
        handle_data_view_request({
          ws,
          user_id,
          request_id,
          params,
          ignore_cache
        }).catch((error) => {
          log('handle_data_view_request failed', {
            request_id,
            error: error.toString()
          })
        })
      } else if (message.type === 'DATA_VIEW_CLIENT_TIMING') {
        handle_client_timing({ ws, payload: message.payload })
      }
    })

    ws.on('close', () => {
      log('WebSocket connection closed', { client_id: ws.client_id, user_id })
      const executions = get_executions(ws)
      for (const [, exec] of executions) {
        exec.controller.abort()
      }
      socket_executions.delete(ws)
    })
  })
}
