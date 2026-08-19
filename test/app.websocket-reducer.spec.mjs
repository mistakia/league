/* global describe it */
import * as chai from 'chai'

import { websocket_reducer } from '@core/ws/reducer'
import { wsActions } from '@core/ws/actions'

const expect = chai.expect

// The socket lifecycle had no reducer at all before this. It exists because a
// stalled data-view request means two different things depending on socket
// state -- disconnected is recoverable and being retried, connected-and-quiet
// is the server owing an answer -- and the page renders a different thing for
// each. A reducer that silently stopped tracking the socket would put every
// disconnected user back on the indistinguishable bare spinner.
describe('websocket reducer', function () {
  it('starts disconnected', function () {
    const state = websocket_reducer(undefined, { type: '@@INIT' })
    expect(state.get('is_connected')).to.equal(false)
  })

  it('marks connected on WEBSOCKET_OPEN', function () {
    const state = websocket_reducer(undefined, wsActions.open())
    expect(state.get('is_connected')).to.equal(true)
  })

  it('marks disconnected on WEBSOCKET_CLOSE', function () {
    const opened = websocket_reducer(undefined, wsActions.open())
    const closed = websocket_reducer(opened, wsActions.close())
    expect(closed.get('is_connected')).to.equal(false)
  })

  it('survives a reconnect cycle', function () {
    let state = websocket_reducer(undefined, wsActions.open())
    state = websocket_reducer(state, wsActions.close())
    state = websocket_reducer(state, wsActions.reconnected())
    // WEBSOCKET_RECONNECTED is dispatched by the reconnect saga only after the
    // socket is already open, so it must not itself flip the flag -- the
    // WEBSOCKET_OPEN that preceded it is what does.
    expect(state.get('is_connected')).to.equal(false)

    state = websocket_reducer(state, wsActions.open())
    expect(state.get('is_connected')).to.equal(true)
  })

  it('ignores unrelated actions', function () {
    const opened = websocket_reducer(undefined, wsActions.open())
    const after = websocket_reducer(opened, { type: 'DATA_VIEW_RESULT' })
    expect(after.get('is_connected')).to.equal(true)
    expect(after).to.equal(opened)
  })
})
