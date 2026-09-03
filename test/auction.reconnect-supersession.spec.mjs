/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import make_recording_timers from './utils/recording-timers.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1

// A RECONNECT REUSES THE CLIENT ID, AND THE SERVER USED TO CALL THAT A
// DUPLICATE.
//
// `clientId` is a uuid minted once per page load, so every socket a tab opens
// over its life carries the same one, and `rejoin_auction` re-sends it verbatim.
// `join` refused any repeat -- which is fine only if the previous socket is
// known to be gone, and it is not: a browser socket carries no protocol
// heartbeat, so a phone changing networks leaves the old connection ESTABLISHED
// on this side long after the client has given up on it and reconnected.
//
// THE REFUSAL IS SILENT AND TOTAL. The new socket gets no message handlers and
// no AUCTION_INIT, while broadcasts keep arriving on it -- those filter on the
// league id in the query string -- so the board looks live, every bid and
// nomination is dropped without an error, and the client sits at its `isPaused`
// default rendering `Auction is paused` over a running auction. That is what
// team 6 hit on 2026-09-03, mid-auction, on a phone.
//
// EVERY ASSERTION HERE DRIVES `join`, not the map it writes. The bug was never a
// wrong value in `_connected_client_ids`; it was which branch `join` took, and a
// spec that inspects the map after setting it up itself cannot see a branch.
describe('auction reconnect supersession', function () {
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

  // Records what was registered on it and whether it was terminated, and can
  // fire its own close -- which is the whole subject of two assertions below,
  // since the defect is about a close arriving LATE and out of order.
  const make_socket = () => {
    const handlers = {}
    return {
      terminated: false,
      on(event, fn) {
        handlers[event] = handlers[event] || []
        handlers[event].push(fn)
      },
      terminate() {
        this.terminated = true
      },
      fire_close() {
        for (const fn of handlers.close || []) fn()
      },
      message_handler_count() {
        return (handlers.message || []).length
      }
    }
  }

  // `_send_auction_init` BROADCASTS rather than replies, so observing it means
  // holding a client in the set it iterates.
  const make_recording_wss = (user_id) => {
    const received = []
    const clients = new Set([
      {
        user_id,
        league_id,
        // `ws`'s WebSocket.OPEN, hardcoded so the stub does not depend on the
        // transport it stands in for.
        readyState: 1,
        send: (payload) => received.push(JSON.parse(payload).type)
      }
    ])
    return { wss: { clients }, received }
  }

  const build_auction = async (user_id) => {
    const { wss, received } = make_recording_wss(user_id)
    const auction = new Auction({
      wss,
      lid: league_id,
      timers: make_recording_timers()
    })
    await auction.setup()
    return { auction, received }
  }

  it('joins a returning client on its new socket', async function () {
    // The defect, stated as the thing a manager needs: the second socket has to
    // come away able to send and having been told the board.
    const { auction, received } = await build_auction(2)
    const first = make_socket()
    const second = make_socket()

    await auction.join({
      ws: first,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })

    received.length = 0

    await auction.join({
      ws: second,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })

    expect(
      second.message_handler_count(),
      'the rejoin registered a message handler; without one every bid and ' +
        'nomination this socket sends is dropped in silence'
    ).to.equal(1)
    expect(received).to.include('AUCTION_INIT')
  })

  it('terminates the socket it replaced', async function () {
    const { auction } = await build_auction(2)
    const first = make_socket()
    const second = make_socket()

    await auction.join({
      ws: first,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })
    await auction.join({
      ws: second,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })

    expect(first.terminated).to.equal(true)
    expect(second.terminated).to.equal(false)
  })

  it('keeps the team present when the replaced socket finally closes', async function () {
    // THE HALF THAT PAUSES THE LEAGUE. The dead socket's close arrives whenever
    // TCP notices, which is after the reconnect by definition -- and it used to
    // splice the manager out of `_connected` and delete the client id the live
    // socket had just registered under. With auto-pause on, that pauses the
    // auction for everyone on a manager who is sitting right there.
    const { auction } = await build_auction(2)
    const first = make_socket()
    const second = make_socket()
    let onclose_calls = 0

    await auction.join({
      ws: first,
      user_id: 2,
      onclose: () => {
        onclose_calls += 1
      },
      client_id: 'tab-a'
    })

    expect(
      auction._connected[2],
      'the fixture gives user 2 team 2 in this league; without that the ' +
        'assertion below passes on an absence rather than on a presence held'
    ).to.deep.equal([2])

    await auction.join({
      ws: second,
      user_id: 2,
      onclose: () => {
        onclose_calls += 1
      },
      client_id: 'tab-a'
    })

    first.fire_close()

    expect(auction._connected[2]).to.deep.equal([2])
    expect(auction._connected_client_ids['tab-a'].ws).to.equal(second)
    expect(onclose_calls, 'a superseded close tears nothing down').to.equal(0)
  })

  it('tears down once when the live socket closes before the one it replaced', async function () {
    // THE OTHER CLOSE ORDER. The guard reads "do I still own this client id",
    // and `undefined` is not ownership -- the entry is deleted only by this
    // handler, so its absence means the teardown already ran. Written as
    // `current && current.ws !== ws` it fell THROUGH on the absent case and ran
    // a second teardown: `onclose` again, which can drop the auction out of the
    // `auctions` map in api/sockets/index.mjs while a socket is still joined,
    // and a duplicate AUCTION_CONNECTED behind it.
    const { auction, received } = await build_auction(2)
    const first = make_socket()
    const second = make_socket()
    let onclose_calls = 0
    const onclose = () => {
      onclose_calls += 1
    }

    await auction.join({ ws: first, user_id: 2, onclose, client_id: 'tab-a' })
    await auction.join({ ws: second, user_id: 2, onclose, client_id: 'tab-a' })

    // The LIVE socket goes first, which is the ordinary case of a manager
    // closing the tab after a reconnect.
    second.fire_close()
    expect(onclose_calls, 'the live socket tore down').to.equal(1)

    received.length = 0
    first.fire_close()

    expect(
      onclose_calls,
      'the corpse tore nothing down a second time'
    ).to.equal(1)
    expect(received).to.not.include('AUCTION_CONNECTED')
  })

  it('registers one message handler when the same socket joins twice', async function () {
    // Both the mount effect and the reconnect saga can send AUCTION_JOIN for one
    // socket -- the client-side fix in `connect_auth` makes that MORE likely, not
    // less. `_setup_message_handlers` adds a listener per call, so without this
    // branch the socket would bid twice for every bid its manager placed.
    const { auction } = await build_auction(2)
    const socket = make_socket()

    await auction.join({
      ws: socket,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })
    await auction.join({
      ws: socket,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })

    expect(socket.message_handler_count()).to.equal(1)
    expect(auction._connected[2]).to.deep.equal([2])
  })

  it('registers one handler when two joins race on one socket', async function () {
    // THE AWAIT IS THE HAZARD. `join` reads the client-id map, then awaits a
    // database round trip to resolve the acting team, then writes. The socket
    // message handler in api/sockets/index.mjs is `async` and its promise is
    // never awaited, so two AUCTION_JOIN frames interleave freely -- and with the
    // claim written after the await, BOTH frames read an empty slot, both passed
    // the same-socket check, and both called `_setup_message_handlers`. The
    // socket then bid twice for every bid its manager placed, at two prices,
    // against their own cap.
    //
    // The client sends exactly this pair: AuctionControls' mount effect and the
    // reconnect saga, both on one socket.
    const { auction } = await build_auction(2)
    const socket = make_socket()

    await Promise.all([
      auction.join({
        ws: socket,
        user_id: 2,
        onclose: () => {},
        client_id: 'tab-a'
      }),
      auction.join({
        ws: socket,
        user_id: 2,
        onclose: () => {},
        client_id: 'tab-a'
      })
    ])

    expect(socket.message_handler_count()).to.equal(1)
    expect(auction._connected[2]).to.deep.equal([2])
  })

  it('refuses a client id held by a different user', async function () {
    // A client id is not a credential, and two users sharing one is a defect
    // rather than a reconnect. This is the narrowing that keeps the supersession
    // above from being a way to displace somebody else's socket.
    const { auction } = await build_auction(2)
    const first = make_socket()
    const second = make_socket()

    await auction.join({
      ws: first,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-a'
    })
    await auction.join({
      ws: second,
      user_id: 3,
      onclose: () => {},
      client_id: 'tab-a'
    })

    expect(second.message_handler_count()).to.equal(0)
    expect(first.terminated).to.equal(false)
    expect(auction._connected_client_ids['tab-a'].user_id).to.equal(2)
  })

  it('joins a first-time client, so the assertions above are not vacuous', async function () {
    // THE CONTROL. Every expectation here is of the form "the join worked", and
    // a `join` broken outright would satisfy the refusal cases while failing the
    // managers this exists for. This is the unperturbed reading.
    const { auction, received } = await build_auction(2)
    const socket = make_socket()

    await auction.join({
      ws: socket,
      user_id: 2,
      onclose: () => {},
      client_id: 'tab-fresh'
    })

    expect(socket.message_handler_count()).to.equal(1)
    expect(received).to.include('AUCTION_INIT')
    expect(auction._connected[2]).to.deep.equal([2])
  })
})
