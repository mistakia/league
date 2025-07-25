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

export const openWS = (params) => {
  if (ws && ws.close) ws.close()
  console.log('connecting to websocket...')
  ws = new WebSocket(`${WS_URL}?${queryString.stringify(params)}`)

  ws.onopen = () => {
    console.log('connected to websocket')
    store.dispatch(wsActions.open())
    messages.forEach((msg) => ws.send(JSON.stringify(msg)))
    messages = []

    interval = setInterval(keepalive, 30000)

    ws.onclose = () => {
      console.log('disconnected from websocket')
      store.dispatch(wsActions.close())
      clearInterval(interval)
    }
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    console.log(`websocket message: ${message.type}`)
    store.dispatch(message)
  }
}

export const closeWS = () => {
  ws.close()
  ws = null
}

export const send = (message) => {
  if (!ws || ws.readyState !== 1) messages.push(message)
  else ws.send(JSON.stringify(message))
}

export const isOpen = () => ws && ws.readyState === 1
