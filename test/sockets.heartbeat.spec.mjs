/* global describe it beforeEach */
import * as chai from 'chai'

import {
  install_websocket_heartbeat,
  HEARTBEAT_INTERVAL_MS
} from '#api/sockets/websocket-heartbeat.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// A DEAD SOCKET IS NOT A CLOSED ONE, and nothing on this side noticed.
//
// A phone that changes network sends no FIN, so the connection stays
// ESTABLISHED here until TCP gives up -- and until then it is in `wss.clients`
// at readyState OPEN, counted as present by the auction's connected-team list
// and its auto-pause denominator, with every broadcast written into a hole. That
// is the state a manager was left in mid-auction on 2026-09-03.
//
// The sweep lived at module scope in `api/index.mjs` against a real interval and
// a real server, which is why it was the one fix of that set with no observable
// anywhere in the suite. It takes an injected clock for the same reason
// `Auction` does.
describe('websocket heartbeat', function () {
  const make_socket = () => {
    const handlers = {}
    return {
      pings: 0,
      terminated: false,
      on(event, fn) {
        handlers[event] = handlers[event] || []
        handlers[event].push(fn)
      },
      ping() {
        this.pings += 1
      },
      terminate() {
        this.terminated = true
      },
      pong() {
        for (const fn of handlers.pong || []) fn()
      }
    }
  }

  // Enough of a `WebSocket.Server` for the sweep: a client set and a
  // `connection` event it can be driven through.
  const make_wss = () => {
    const connection_handlers = []
    return {
      clients: new Set(),
      on(event, fn) {
        if (event === 'connection') connection_handlers.push(fn)
      },
      connect(socket) {
        this.clients.add(socket)
        for (const fn of connection_handlers) fn(socket)
        return socket
      }
    }
  }

  let ticks
  let cleared
  let timers

  beforeEach(function () {
    ticks = []
    cleared = []
    timers = {
      set_interval: (fn, ms) => {
        ticks.push({ fn, ms })
        return ticks.length - 1
      },
      clear_interval: (handle) => cleared.push(handle)
    }
  })

  const tick = () => ticks[0].fn()

  it('pings a live socket rather than terminating it', function () {
    const wss = make_wss()
    install_websocket_heartbeat({ wss, timers })
    const socket = wss.connect(make_socket())

    tick()

    expect(socket.pings).to.equal(1)
    expect(socket.terminated).to.equal(false)
  })

  it('terminates a socket that missed its pong', function () {
    // THE WHOLE POINT. One sweep marks it unanswered, the next kills it -- and
    // the terminate is what fires the close handlers the auction's disconnect
    // story hangs off.
    const wss = make_wss()
    install_websocket_heartbeat({ wss, timers })
    const socket = wss.connect(make_socket())

    tick()
    tick()

    expect(socket.terminated).to.equal(true)
  })

  it('spares a socket that answered', function () {
    // THE CONTROL, and without it the assertion above is satisfied by a sweep
    // that terminates everything on the second pass regardless of the pong --
    // which would disconnect every healthy client in the league every 60
    // seconds. The two readings have to differ.
    const wss = make_wss()
    install_websocket_heartbeat({ wss, timers })
    const socket = wss.connect(make_socket())

    tick()
    socket.pong()
    tick()

    expect(socket.terminated).to.equal(false)
    expect(socket.pings).to.equal(2)
  })

  it('pings a socket it has never swept rather than killing it', function () {
    // `is_alive === false`, not falsy. A client of a server this was installed
    // on after it started serving carries `is_alive` undefined, and a falsy test
    // would terminate every one of them on the first sweep.
    const wss = make_wss()
    install_websocket_heartbeat({ wss, timers })
    const socket = make_socket()
    wss.clients.add(socket)

    tick()

    expect(socket.terminated).to.equal(false)
    expect(socket.pings).to.equal(1)
  })

  it('stops when its stopper is called', function () {
    // `wss.on('close')` never fires for a `noServer` server unless someone calls
    // `wss.close()`, so the interval cannot be left to it.
    const wss = make_wss()
    const stop = install_websocket_heartbeat({ wss, timers })

    stop()

    expect(cleared).to.have.length(1)
  })

  it('sweeps on the published interval', function () {
    const wss = make_wss()
    install_websocket_heartbeat({ wss, timers })

    expect(ticks[0].ms).to.equal(HEARTBEAT_INTERVAL_MS)
  })
})
