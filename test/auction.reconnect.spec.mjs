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
})
