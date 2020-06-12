import { WS_URL } from '@core/constants'
import { store } from '@core/store'

import { wsActions } from './actions'

export let ws = null
let messages = []

export const connectWS = (token) => {
  ws = new WebSocket(`${WS_URL}?token=${token}`)

  ws.onopen = () => {
    store.dispatch(wsActions.open())
    messages.forEach((msg) => ws.send(JSON.stringify(msg)))
    messages = []
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    store.dispatch(message)
  }

  ws.onclose = () => {
    store.dispatch(wsActions.close())
  }
}

export const send = (message) => {
  if (ws.readyState !== 1) messages.push(message)
  else ws.send(JSON.stringify(message))
}
