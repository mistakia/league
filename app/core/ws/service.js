import { WS_URL } from '@core/constants'
import { store } from '@core/store'

import { wsActions } from './actions'

let ws = null

export const connectWS = (token) => {
  ws = new WebSocket(`${WS_URL}?token=${token}`)
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    store.dispatch(message)
  }

  ws.onclose = () => {
    store.dispatch(wsActions.close())
  }
}

export { ws }
