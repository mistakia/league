/* global describe it */
import * as chai from 'chai'

import {
  resolve_history_step,
  describe_history_position
} from '@core/data-views/history-position.mjs'

const expect = chai.expect

// The history is a list of snapshots; only table_state is read here, so the
// entries carry nothing else. `columns` is what a real snapshot varies on, so
// the states differ on the field the app itself compares.
const entry = (name) => ({ table_state: { columns: [name] } })
const state = (name) => ({ columns: [name] })

const linear = [entry('a'), entry('b'), entry('c')]

describe('app data view history position', function () {
  describe('stepping back', function () {
    it('steps to the entry before the current one', function () {
      expect(
        resolve_history_step({
          history: linear,
          table_state: state('c'),
          direction: 'back'
        })
      ).to.equal(1)
    })

    // THE REGRESSION THIS FILE EXISTS FOR. The old derivation walked down from
    // the newest entry to the first one that DIFFERED from the current state,
    // which is the position of the newest OTHER state rather than the position
    // of this one. From the newest entry that reads as one step back, so the
    // first press looked correct; from the middle it returned the newest index,
    // so pressing undo twice landed back where the user started and pressing it
    // forever alternated between two states.
    //
    // Driven as a WALK rather than as a single call, because a single call from
    // the middle is exactly what the old code got right-looking by accident:
    // the defect is only visible in the trajectory.
    it('keeps walking backwards instead of oscillating between two states', function () {
      const visited = []
      let table_state = state('c')
      for (let press = 0; press < 2; press += 1) {
        const index = resolve_history_step({
          history: linear,
          table_state,
          direction: 'back'
        })
        visited.push(index)
        table_state = linear[index].table_state
      }
      expect(visited).to.eql([1, 0])
    })

    it('reports no step available at the oldest entry', function () {
      expect(
        resolve_history_step({
          history: linear,
          table_state: state('a'),
          direction: 'back'
        })
      ).to.equal(-1)
    })

    // A save writes a `server_save` entry for a state a `user_edit` entry
    // already holds, so consecutive twins are ordinary. Landing on one would
    // look like the control doing nothing.
    it('skips a consecutive twin of the current state', function () {
      const history = [entry('a'), entry('b'), entry('b')]
      expect(
        resolve_history_step({
          history,
          table_state: state('b'),
          direction: 'back'
        })
      ).to.equal(0)
    })

    // A debounced edit not yet persisted, or a generated view just applied.
    it('returns to the newest entry from a state that is not in the history', function () {
      expect(
        resolve_history_step({
          history: linear,
          table_state: state('unrecorded'),
          direction: 'back'
        })
      ).to.equal(2)
    })
  })

  describe('stepping forward', function () {
    it('steps to the entry after the current one', function () {
      expect(
        resolve_history_step({
          history: linear,
          table_state: state('a'),
          direction: 'forward'
        })
      ).to.equal(1)
    })

    it('reports no step available at the newest entry', function () {
      expect(
        resolve_history_step({
          history: linear,
          table_state: state('c'),
          direction: 'forward'
        })
      ).to.equal(-1)
    })

    // Nothing is ahead of a state that was never recorded.
    it('offers nothing from a state that is not in the history', function () {
      expect(
        resolve_history_step({
          history: linear,
          table_state: state('unrecorded'),
          direction: 'forward'
        })
      ).to.equal(-1)
    })

    it('returns a user stepped back to exactly where they left', function () {
      const back = resolve_history_step({
        history: linear,
        table_state: state('c'),
        direction: 'back'
      })
      const forward = resolve_history_step({
        history: linear,
        table_state: linear[back].table_state,
        direction: 'forward'
      })
      expect(forward).to.equal(2)
    })
  })

  describe('an empty or absent history', function () {
    it('offers no step in either direction', function () {
      for (const direction of ['back', 'forward']) {
        expect(
          resolve_history_step({
            history: [],
            table_state: state('a'),
            direction
          })
        ).to.equal(-1)
        expect(
          resolve_history_step({
            history: null,
            table_state: state('a'),
            direction
          })
        ).to.equal(-1)
      }
    })
  })

  describe('the position readout', function () {
    it('is one-based over the history length', function () {
      expect(
        describe_history_position({ history: linear, table_state: state('b') })
      ).to.eql({ position: 2, total: 3 })
    })

    it('is zero for a state the history does not hold', function () {
      expect(
        describe_history_position({
          history: linear,
          table_state: state('unrecorded')
        })
      ).to.eql({ position: 0, total: 3 })
    })

    it('is zero of zero with no history', function () {
      expect(
        describe_history_position({ history: [], table_state: state('a') })
      ).to.eql({ position: 0, total: 0 })
    })
  })
})
