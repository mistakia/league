import { Map } from 'immutable'

import { wsActions } from './actions'

// Nothing reduced the socket lifecycle before this. It is needed because a
// stalled request means two different things to a user depending on socket
// state -- disconnected is "we are getting you back", connected-and-quiet is
// "the server owes you an answer" -- and only one of them is an error.
const initial_state = new Map({
  is_connected: false
})

export function websocket_reducer(state = initial_state, { type }) {
  switch (type) {
    case wsActions.WEBSOCKET_OPEN:
      return state.set('is_connected', true)

    case wsActions.WEBSOCKET_CLOSE:
      return state.set('is_connected', false)

    default:
      return state
  }
}
