/* global describe it */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as chai from 'chai'

import { auction_reducer } from '@core/auction/reducer'
import { auction_actions } from '@core/auction/actions'

const expect = chai.expect
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// `AUCTION IS PAUSED` WAS THIS CLIENT'S DEFAULT, REPORTED AS A FACT.
//
// `isPaused` opens true so the controls stay hidden until the auction is known,
// which is right. What was wrong is that nothing else recorded whether it had
// been ANSWERED -- so "the server has not told us yet" and "the commissioner
// paused the auction" rendered as the same screen, and that screen names the
// second one. Every manager saw it for the length of a page load, and a client
// whose AUCTION_INIT never arrived saw it until they reloaded: a socket swapped
// on sign-in, a reconnect the server refused as a duplicate, a phone tab the
// browser discarded and restored. On 2026-09-03 that was a manager staring at
// `Auction is paused` while four other teams settled elections on the player he
// was being asked about.
//
// `is_initialized` is the answered/unanswered bit, and it is deliberately set by
// AUCTION_INIT alone -- the one message carrying the whole board.
describe('auction initialization gate', function () {
  describe('the flag', function () {
    it('starts unanswered', function () {
      const state = auction_reducer(undefined, { type: 'UNRELATED' })

      expect(state.is_initialized).to.equal(false)
      expect(
        state.isPaused,
        'the controls still stay hidden until the auction is known; the gate ' +
          'changes what is SAID, not what is offered'
      ).to.equal(true)
    })

    it('is answered by AUCTION_INIT', function () {
      const state = auction_reducer(undefined, {
        type: auction_actions.AUCTION_INIT,
        payload: {
          transactions: [],
          tids: [],
          teams: [],
          connected: [],
          paused: false
        }
      })

      expect(state.is_initialized).to.equal(true)
      expect(state.isPaused).to.equal(false)
    })

    it('carries a real pause through, so the gate does not hide one', function () {
      // THE CONTROL. A gate that reported "not initialized" forever would
      // satisfy the first assertion and silently swallow every genuine pause,
      // which is worse than the defect it replaces.
      const state = auction_reducer(undefined, {
        type: auction_actions.AUCTION_INIT,
        payload: {
          transactions: [],
          tids: [],
          teams: [],
          connected: [],
          paused: true
        }
      })

      expect(state.is_initialized).to.equal(true)
      expect(state.isPaused).to.equal(true)
    })

    it('clears a live-block pause when the mode flips to election', function () {
      // THE CLIENT MIRROR OF THE SERVER LATCH, and it survives the server fix on
      // its own. In election mode nothing broadcasts AUCTION_START, and only
      // AUCTION_BID and AUCTION_PROCESSED otherwise clear `isPaused` -- so a
      // client that took one AUCTION_PAUSED inside a live block kept rendering
      // `Auction is paused` for the whole election window that followed, with
      // `is_initialized` true, so the load gate does not cover it.
      const paused = auction_reducer(
        auction_reducer(undefined, {
          type: auction_actions.AUCTION_INIT,
          payload: {
            transactions: [],
            tids: [],
            teams: [],
            connected: [],
            paused: false,
            auction_mode: 'live'
          }
        }),
        { type: auction_actions.AUCTION_PAUSED }
      )
      expect(paused.isPaused, 'the live-block pause took').to.equal(true)

      const after = auction_reducer(paused, {
        type: auction_actions.AUCTION_MODE,
        payload: {
          auction_mode: 'election',
          block_end_at: null,
          is_final_block: false
        }
      })

      expect(after.auction_mode).to.equal('election')
      expect(after.isPaused).to.equal(false)
    })

    it('leaves a pause alone when the mode flips to live', function () {
      // THE CONTROL. A blanket `isPaused: false` on every AUCTION_MODE would
      // satisfy the test above and silently discard a commissioner's pause the
      // moment a block convened -- which is when a pause has a clock to stop and
      // therefore means something.
      const paused = auction_reducer(undefined, {
        type: auction_actions.AUCTION_PAUSED
      })

      const after = auction_reducer(paused, {
        type: auction_actions.AUCTION_MODE,
        payload: {
          auction_mode: 'live',
          block_end_at: 123,
          is_final_block: false
        }
      })

      expect(after.auction_mode).to.equal('live')
      expect(after.isPaused).to.equal(true)
    })

    it('is not answered by joining, only by being told', function () {
      // Sending AUCTION_JOIN is not hearing back. This is the distinction the
      // whole gate rests on: the defect cases are all ones where the client
      // joined and the server never answered.
      const state = auction_reducer(undefined, {
        type: auction_actions.AUCTION_JOIN
      })

      expect(state.is_joined).to.equal(true)
      expect(state.is_initialized).to.equal(false)
    })
  })

  // Source gates, because there is no jsdom in this repository and these
  // components cannot be rendered. They catch the branch being deleted, not the
  // copy being wrong.
  describe('the surfaces that say it', function () {
    const read = (relative) =>
      fs.readFileSync(path.join(repo_root, relative), 'utf8')

    it('gates the bid bar on the flag before it reads the pause', function () {
      const source = read(
        'app/views/components/auction-main-bid/auction-main-bid.js'
      )
      const gate_at = source.indexOf('} else if (!is_initialized) {')
      const paused_at = source.indexOf(
        "main = <div className='auction__text'>Auction is paused</div>"
      )

      expect(gate_at).to.be.above(-1)
      expect(paused_at).to.be.above(gate_at)
    })

    it('gates the status rail the same way', function () {
      const source = read(
        'app/views/components/auction-status/auction-status.js'
      )
      const gate_at = source.indexOf('} else if (!is_initialized) {')
      const paused_at = source.indexOf("line = 'Auction is paused.'")

      expect(gate_at).to.be.above(-1)
      expect(paused_at).to.be.above(gate_at)
    })
  })

  // A DECLINE IS NOT A SOCKET WRITE. It posts to `/auction-elections`, which has
  // no pause check and needs none, so drawing it under the bid clock's flag took
  // the control away on exactly the screens that most needed it -- and made one
  // wrong `isPaused` into two symptoms a manager reports separately.
  describe('the decline control', function () {
    // Read inside each test rather than at describe scope: a `readFileSync` that
    // runs while the describe callback executes throws during FILE LOAD, and
    // mocha then reports a load failure with no test names instead of one red
    // assertion.
    const read_source = () =>
      fs.readFileSync(
        path.join(
          repo_root,
          'app/views/components/auction-main-bid/auction-main-bid.js'
        ),
        'utf8'
      )

    it('does not draw on the running flag', function () {
      const source = read_source()
      // The paired negative that used to sit here targeted
      // `{is_election_mode && nominated_pid && (`, a string no longer anywhere
      // in the tree -- so it could not be validated against a known match, and
      // it was pinned to one prettier line break of the old form. A regression
      // spelled `{is_running && is_election_mode && ...` walked straight past
      // it. The positive below is what carries the property.
      expect(source).to.include('{show_election_control && (')
    })

    it('reaches the actions row when only the election control shows', function () {
      // THE OUTER WRAPPER, and without this assertion the whole decline fix is
      // revertible with every other gate here still green. `show_election_control`
      // is computed correctly and the inner `{show_election_control && (` still
      // reads right -- but if the row itself is drawn on `{is_running && (`,
      // nothing inside it renders while the client believes the auction is
      // paused, which is precisely the symptom team 6 reported.
      expect(read_source()).to.include(
        '{(is_running || show_election_control) && ('
      )
    })

    it('states the condition without the pause in it', function () {
      const source = read_source()
      // Bounded FORWARD from the declaration. `classNames` is declared a
      // hundred lines EARLIER in this file, so slicing to it yields the empty
      // string and every `not.include` below passes against nothing at all --
      // which is the vacuous-negative shape this repo has been bitten by, and
      // it is what prettier reflowing the condition onto four lines exposed.
      const start = source.indexOf('const show_election_control =')
      expect(start, 'the condition is still declared by this name').to.be.above(
        -1
      )
      const condition = source.slice(start, source.indexOf('return (', start))

      expect(condition).to.include('is_election_mode')
      expect(condition).to.include('is_initialized')
      expect(condition).to.not.include('isPaused')
      expect(condition).to.not.include('is_running')
    })
  })
})
