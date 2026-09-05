/* global describe it */
import * as chai from 'chai'

import { transaction_types } from '#constants'
import classify_auction_transactions from '@core/auction/classify-auction-transactions.mjs'
import { auction_reducer } from '@core/auction/reducer.js'
import { auction_actions } from '@core/auction/actions.js'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// The auction side rail splits the transaction log into nominations, bids and
// sales, and NEITHER HALF OF THAT IS READABLE OFF A ROW ON ITS OWN.
//
// A nomination is an ordinary `AUCTION_BID` row -- `_create_nomination_bid`
// writes the same row `_create_bid_record` does -- so the kind is positional.
// And an election-mode sale arrives as a broadcast payload carrying no `type`
// at all, because `broadcast_auction_settlement` sends the price and the winner
// and nothing else, so the reducer stamps it.
//
// NO DATABASE. Both halves are pure, and the second is exactly the tier the
// auction guide names as where a broadcast dies: a payload with no reducer
// handling does not error, it simply renders as nothing.
describe('auction transaction classification', function () {
  const bid = (pid, tid, player_salary) => ({
    type: transaction_types.AUCTION_BID,
    pid,
    tid,
    player_salary
  })
  const sale = (pid, tid, player_salary) => ({
    type: transaction_types.AUCTION_PROCESSED,
    pid,
    tid,
    player_salary
  })

  describe('classify_auction_transactions', function () {
    it('reads the first bid on a player as its nomination', function () {
      // Newest first, the order the client holds them in.
      const kinds = classify_auction_transactions([
        bid('PLAYER-A', 3, 8),
        bid('PLAYER-A', 2, 5),
        bid('PLAYER-A', 1, 1)
      ])
      expect(kinds).to.eql(['bid', 'bid', 'nomination'])
    })

    it('reads a sale as processed and opens the next player fresh', function () {
      // The negative control for the case above: without the reset, a rule that
      // simply called every bid after the first one a bid would put the second
      // player's nomination in the wrong bucket.
      const kinds = classify_auction_transactions([
        bid('PLAYER-B', 4, 3),
        sale('PLAYER-A', 2, 5),
        bid('PLAYER-A', 2, 5),
        bid('PLAYER-A', 1, 1)
      ])
      expect(kinds).to.eql(['nomination', 'processed', 'bid', 'nomination'])
    })

    it('reads an election-mode sale carrying no transaction id as processed', function () {
      const kinds = classify_auction_transactions([
        { type: transaction_types.AUCTION_PROCESSED, pid: 'PLAYER-A', tid: 2 },
        bid('PLAYER-A', 1, 1)
      ])
      expect(kinds).to.eql(['processed', 'nomination'])
    })
  })

  describe('the reducer stamps a settlement broadcast', function () {
    const initial_state = auction_reducer(undefined, { type: '@@INIT' })

    it('stamps AUCTION_PROCESSED onto a payload that carries no type', function () {
      // Exactly what `broadcast_auction_settlement` puts on the wire: the
      // winner and the price, no type, no transaction id, no timestamp.
      const state = auction_reducer(initial_state, {
        type: auction_actions.AUCTION_PROCESSED,
        payload: { pid: 'PLAYER-A', tid: 2, player_salary: 5 }
      })

      const transaction = state.transactions.first()
      expect(transaction.type).to.equal(transaction_types.AUCTION_PROCESSED)
      expect(
        classify_auction_transactions(state.transactions.toArray())
      ).to.eql(['processed'])
    })

    it('leaves a bid a bid', function () {
      // The control for the stamp: it must not reclassify the other broadcast
      // that lands in this same list.
      const state = auction_reducer(initial_state, {
        type: auction_actions.AUCTION_BID,
        payload: bid('PLAYER-A', 1, 1)
      })

      expect(state.transactions.first().type).to.equal(
        transaction_types.AUCTION_BID
      )
      expect(
        classify_auction_transactions(state.transactions.toArray())
      ).to.eql(['nomination'])
    })
  })
})
