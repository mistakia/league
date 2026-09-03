/* global WebSocket, setInterval, clearInterval */

import queryString from 'query-string'

import { WS_URL } from '@core/constants'
import { store } from '@core/store'

import { wsActions } from './actions'
import { enqueue, flush, clear } from './send-queue'

export let ws = null
let interval = null

const keepalive_message = JSON.stringify({ type: 'KEEPALIVE' })
const keepalive = () => {
  if (ws && ws.readyState === 1) ws.send(keepalive_message)
}

// Drop a socket we are deliberately replacing or shutting down. Detaching the
// handlers first is what keeps WEBSOCKET_CLOSE meaning "the connection dropped
// on us" and nothing else: the reconnect saga runs off WEBSOCKET_CLOSE under
// takeLatest, so an intentional close that still dispatched it would cancel and
// restart the very reconnect attempt that issued the close, spinning forever.
const discard_socket = (socket) => {
  if (!socket) return
  socket.onopen = null
  socket.onclose = null
  socket.onmessage = null
  socket.onerror = null
  if (socket.close) socket.close()
}

export const openWS = (params) => {
  discard_socket(ws)
  // Nothing written against the socket we just discarded may reach the one we
  // are about to open -- see send-queue.js. Both registrations re-send
  // themselves off WEBSOCKET_RECONNECTED, so this drops nothing that is owed.
  clear()
  console.log('connecting to websocket...')
  const socket = new WebSocket(`${WS_URL}?${queryString.stringify(params)}`)
  ws = socket

  // Installed here, NOT inside onopen. A socket that fails before it ever opens
  // (the common case for an offline or throttled client) otherwise closes with
  // no handler attached, so WEBSOCKET_CLOSE never fires and reconnect never
  // runs -- the connection is simply gone with nothing observing it.
  socket.onclose = () => {
    console.log('disconnected from websocket')
    clearInterval(interval)
    store.dispatch(wsActions.close())
  }

  socket.onopen = () => {
    console.log('connected to websocket')
    store.dispatch(wsActions.open())
    flush(socket)

    interval = setInterval(keepalive, 30000)
  }

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    console.log(`websocket message: ${message.type}`)
    store.dispatch(message)
  }
}

export const closeWS = () => {
  clearInterval(interval)
  discard_socket(ws)
  clear()
  ws = null
}

// `queue_until_open` is the caller stating that this message is a per-socket
// REGISTRATION -- idempotent, carrying no board state, correct to replay onto
// whatever socket opens. It defaults off so that a command written while the
// socket is not open is dropped rather than delivered as a decision the manager
// made against a board that has since moved. Returns whether it went out.
export const send = (message, { queue_until_open = false } = {}) => {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message))
    return true
  }

  if (queue_until_open) {
    enqueue(message)
    return false
  }

  console.log(`websocket not open, dropped: ${message.type}`)
  return false
}

export const isOpen = () => ws && ws.readyState === 1
