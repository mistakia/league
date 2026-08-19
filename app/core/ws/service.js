/* global WebSocket, setInterval, clearInterval */

import queryString from 'query-string'

import { WS_URL } from '@core/constants'
import { store } from '@core/store'

import { wsActions } from './actions'

export let ws = null
let messages = []
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
    messages.forEach((msg) => socket.send(JSON.stringify(msg)))
    messages = []

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
  ws = null
}

export const send = (message) => {
  if (!ws || ws.readyState !== 1) messages.push(message)
  else ws.send(JSON.stringify(message))
}

export const isOpen = () => ws && ws.readyState === 1
