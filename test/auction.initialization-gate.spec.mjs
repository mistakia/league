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
    const source = fs.readFileSync(
      path.join(
        repo_root,
        'app/views/components/auction-main-bid/auction-main-bid.js'
      ),
      'utf8'
    )

    it('does not draw on the running flag', function () {
      expect(source).to.include('{show_election_control && (')
      expect(source).to.not.include('{is_election_mode && nominated_pid && (')
    })

    it('states the condition without the pause in it', function () {
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
