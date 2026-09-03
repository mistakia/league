/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import sockets from '#api/sockets/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1

// THE SOCKET TEARDOWN CAN KILL THE API PROCESS, and the path is ordinary.
//
// `onclose` in api/sockets/index.mjs reads the auction back out of the module's
// map and dereferences it. When the auction has already been deleted the read is
// `undefined`, so the dereference throws -- inside a `'close'` listener, which
// makes it an uncaughtException, and `server.mjs` installs a handler that calls
// `process.exit(1)`. One league's last manager leaving takes down every socket
// in every league.
//
// The standing case is the teamless commissioner. `Auction.join` admits them
// deliberately, and `_connected` is keyed by TEAM, so they are never counted in
// it -- the last MANAGER to leave empties the map and deletes the auction while
// the commissioner is still connected. Their close then finds nothing.
//
// Rare only because a departed socket used to sit ESTABLISHED for a long time.
// The websocket heartbeat terminates a dead socket within two sweeps, which is
// what turns this from a curiosity into an ordinary Tuesday.
describe('auction socket teardown', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
  })

  const make_socket = () => {
    const handlers = {}
    const received = []
    return {
      league_id,
      readyState: 1,
      received,
      send: (payload) => received.push(JSON.parse(payload).type),
      on(event, fn) {
        handlers[event] = handlers[event] || []
        handlers[event].push(fn)
      },
      async receive(message) {
        for (const fn of handlers.message || [])
          await fn(JSON.stringify(message))
      },
      fire_close() {
        for (const fn of handlers.close || []) fn()
      }
    }
  }

  // Drives the REAL socket entry point, because the closure under test is built
  // inside it and is reachable no other way.
  const make_wss = () => {
    const connection_handlers = []
    const wss = {
      clients: new Set(),
      on(event, fn) {
        if (event === 'connection') connection_handlers.push(fn)
      },
      connect(socket, user_id) {
        socket.user_id = user_id
        wss.clients.add(socket)
        for (const fn of connection_handlers) {
          fn(socket, { auth: { userId: user_id } })
        }
        return socket
      }
    }
    sockets(wss)
    return wss
  }

  const join = async (wss, user_id, client_id) => {
    const socket = wss.connect(make_socket(), user_id)
    await socket.receive({
      type: 'AUCTION_JOIN',
      payload: { lid: league_id, clientId: client_id }
    })
    return socket
  }

  it('survives a close after the auction was already discarded', async function () {
    // A commissioner who manages no team -- the configuration `Auction.join`
    // documents as supported, not a contrivance. The fixture makes user 1 the
    // commissioner AND gives them team 1, so their ownership row is dropped
    // rather than a new user invented, which keeps every foreign key intact.
    const teamless_commissioner = 1
    await knex('users_teams').where({ user_id: teamless_commissioner }).del()

    const wss = make_wss()
    const commissioner = await join(wss, teamless_commissioner, 'commish-tab')
    const manager = await join(wss, 2, 'manager-tab')

    // The manager is the only presence `_connected` holds, so their close
    // empties it and the auction is discarded.
    manager.fire_close()

    // Before the guard this threw a TypeError out of a close listener, which
    // `install_process_handlers` turns into process.exit(1).
    expect(() => commissioner.fire_close()).to.not.throw()
  })

  it('still discards an auction nobody is connected to', async function () {
    // THE CONTROL. `if (!auction) return` placed one line too high -- or written
    // as an unconditional return -- would satisfy the assertion above by never
    // cleaning up at all, leaking an Auction and its mode-poll timer per league
    // for the life of the process. Rejoining has to build a NEW auction, which
    // is observable as a fresh AUCTION_INIT on a socket that never asked twice.
    const wss = make_wss()
    const manager = await join(wss, 2, 'manager-tab')
    expect(manager.received, 'the first join built an auction').to.include(
      'AUCTION_INIT'
    )

    manager.fire_close()

    // A fresh AUCTION_INIT is the observable that a NEW Auction was constructed:
    // it is sent from `join`, which the entry point only reaches after building
    // and setting up an auction the map no longer had.
    const returning = await join(wss, 2, 'another-tab')

    expect(returning.received).to.include('AUCTION_INIT')
  })
})
