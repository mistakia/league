/* global describe it */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as chai from 'chai'

import { auction_reducer } from '@core/auction/reducer'
import { auction_actions } from '@core/auction/actions'

const expect = chai.expect
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// A JOIN IS PER SOCKET, AND A RECONNECT IS A NEW SOCKET.
//
// The server keys the auction's message handlers, its connected-team list and
// its AUCTION_INIT off the socket that sent AUCTION_JOIN. Nothing re-sent one
// after a reconnect -- `auction/sagas.js` carried a TODO saying exactly that --
// and the failure is silent rather than loud: broadcasts keep arriving, because
// those are filtered on the league id the connection query string carries, so
// the board still looks live while every bid and nomination the manager sends is
// dropped with no error and their team reads as disconnected to everyone else.
// With `pause_on_team_disconnect` on, that pauses the block for the whole
// league.
//
// WHAT IS NOT DRIVEN HERE, said plainly rather than asserted weakly. The
// generator itself cannot be run: `@core/auction/sagas` imports `send` from the
// `@core/ws` barrel, which re-exports `service.js`, which imports `@core/store`
// -- and the store reads `window.__INITIAL_STATE__` and builds browser history
// at MODULE SCOPE. Importing it from a spec throws `window is not defined`
// before any test runs, and there is no jsdom in this repository. So the state
// half below is executed and the wiring half is a source gate, which catches the
// watcher being deleted but not the effect order being wrong.
describe('auction rejoin on websocket reconnect', function () {
  describe('the flag the rejoin decides on', function () {
    it('records that this client joined', function () {
      const state = auction_reducer(undefined, {
        type: auction_actions.AUCTION_JOIN
      })
      expect(state.is_joined).to.equal(true)
    })

    // THE CONTROL, and it is what makes the assertion above mean something.
    // `_send_auction_init` BROADCASTS rather than replying, so every client in
    // the league receives auction state whenever anybody joins. A rejoin keyed
    // on having SEEN state would have the whole league re-joining an auction
    // most of them never opened, and would satisfy the test above just as well.
    it('starts out not joined, and stays that way on an unrelated message', function () {
      expect(
        auction_reducer(undefined, { type: 'UNRELATED' }).is_joined
      ).to.equal(false)

      const after_init = auction_reducer(undefined, {
        type: auction_actions.AUCTION_INIT,
        payload: { transactions: [], tids: [], teams: [], connected: [] }
      })
      expect(
        after_init.is_joined,
        'receiving broadcast state is not joining'
      ).to.equal(false)
    })
  })

  describe('the wiring', function () {
    const sagas_source = fs.readFileSync(
      path.join(repo_root, 'app/core/auction/sagas.js'),
      'utf8'
    )

    it('forks a watcher on WEBSOCKET_RECONNECTED', function () {
      expect(sagas_source).to.include('fork(watch_websocket_reconnected)')
      expect(sagas_source).to.include(
        'takeLatest(wsActions.WEBSOCKET_RECONNECTED, rejoin_auction)'
      )
    })

    it('guards the rejoin on this client having joined', function () {
      expect(sagas_source).to.include('if (!is_joined) return')
    })

    // The TODO this replaced. Asserting its absence is what stops the fix being
    // reverted into the comment it came from.
    it('no longer defers the rejoin to a comment', function () {
      expect(sagas_source).to.not.include(
        'auto rejoin auction on websocket reconnection'
      )
    })
  })

  // A DELIBERATE SWAP IS ALSO A NEW SOCKET, and it was the one nothing
  // announced.
  //
  // `connect_auth` replaces the connection on sign-in, and `closeWS` detaches
  // `onclose` on purpose -- so that swap dispatches no WEBSOCKET_CLOSE, the
  // reconnect loop never runs, and WEBSOCKET_RECONNECTED was never put. The
  // rejoin above therefore covered every dropped connection EXCEPT the one that
  // happens on every sign-in, which is the ordering that loses the auction join
  // outright: AuctionControls sends AUCTION_JOIN from an effect keyed on
  // `is_logged_in`, and on the ordering where the effect wins it goes out on the
  // socket about to be discarded.
  //
  // A source gate for the same reason as the block above -- `@core/ws/sagas`
  // reaches `@core/store`, which reads `window` at module scope.
  describe('the deliberate socket swap', function () {
    const ws_sagas_source = fs.readFileSync(
      path.join(repo_root, 'app/core/ws/sagas.js'),
      'utf8'
    )

    // SCOPED TO ONE FUNCTION, and the first draft of this block was not.
    //
    // `reconnect()` has ALWAYS ended in `yield put(wsActions.reconnected())` --
    // that is the announcement for an unexpected drop, which was never the
    // missing half. A file-wide `include` therefore matched that line and passed
    // with the fix deleted, and the ordering assertion passed with it because
    // `reconnect()` sits later in the file than `connect_auth`'s `call(connect)`.
    // Both read exactly like a fix under test. The mutation run is what said
    // otherwise.
    //
    // The first `\n}\n` after a top-level signature is its closing brace, since
    // everything nested is indented.
    const body_of = (signature) => {
      const start = ws_sagas_source.indexOf(signature)
      expect(start, `${signature} is still declared`).to.be.above(-1)
      const end = ws_sagas_source.indexOf('\n}\n', start)
      expect(end, `${signature} has a closing brace`).to.be.above(start)
      return ws_sagas_source.slice(start, end)
    }

    const connect_auth_body = body_of('export function* connect_auth()')

    it('cuts the body of connect_auth and nothing else', function () {
      // THE CONTROL ON THE SLICE. Every assertion below is only worth what this
      // one is: if the slice ran past its function it would swallow
      // `reconnect()` and go green on that function's announcement, which is the
      // exact false pass this block already produced once.
      expect(connect_auth_body).to.include('yield call(disconnect)')
      expect(
        connect_auth_body,
        'the slice must not reach reconnect(), whose put is not the one under test'
      ).to.not.include('while (!isOpen())')
    })

    it('announces the new socket after an auth swap', function () {
      expect(connect_auth_body).to.include('yield put(wsActions.reconnected())')
    })

    it('announces it AFTER connecting, not before', function () {
      // Order is the whole property. Put ahead of `connect` and the rejoin
      // sends AUCTION_JOIN into the socket being torn down, which is the defect
      // restated rather than fixed.
      const connect_at = connect_auth_body.indexOf('yield call(connect)')
      const put_at = connect_auth_body.indexOf(
        'yield put(wsActions.reconnected())'
      )

      expect(connect_at).to.be.above(-1)
      expect(put_at).to.be.above(connect_at)
    })
  })
})
