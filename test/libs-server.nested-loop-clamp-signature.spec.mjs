/* global describe it */

// The targeting rule for the data-view re-plan. Both halves of the conjunction
// are checked in isolation as well as together, because a rule that fired on
// either half alone would either apply `enable_nestloop = off` to statements it
// regresses (a small view was measured going from 851ms to 9,198ms under a
// blanket setting) or fail to apply it to the shapes running 305,000ms.

import * as chai from 'chai'

import {
  plan_carries_clamp_signature,
  extract_plan_from_explain_response
} from '#libs-server/data-views/nested-loop-clamp-signature.mjs'

const { expect } = chai

const scan = ({ rows = 100 } = {}) => ({
  'Node Type': 'Seq Scan',
  'Plan Rows': rows
})

const clamped_join = ({ node_type = 'Hash Join' } = {}) => ({
  'Node Type': node_type,
  'Plan Rows': 1,
  Plans: [scan(), scan()]
})

const filtered_nested_loop = ({ children = [scan(), scan()] } = {}) => ({
  'Node Type': 'Nested Loop',
  'Plan Rows': 500,
  'Join Filter': 'pgl.pid = player.pid',
  Plans: children
})

describe('nested loop clamp signature', () => {
  it('flags a clamped join above a filtered nested loop', () => {
    const plan = filtered_nested_loop({ children: [clamped_join(), scan()] })
    expect(plan_carries_clamp_signature(plan)).to.equal(true)
  })

  it('flags the two halves in either order in the tree', () => {
    const plan = {
      'Node Type': 'Hash Join',
      'Plan Rows': 1,
      Plans: [filtered_nested_loop(), scan()]
    }
    expect(plan_carries_clamp_signature(plan)).to.equal(true)
  })

  it('does not flag a clamped join with no filtered nested loop', () => {
    expect(plan_carries_clamp_signature(clamped_join())).to.equal(false)
  })

  it('does not flag a filtered nested loop with no clamped join', () => {
    expect(plan_carries_clamp_signature(filtered_nested_loop())).to.equal(false)
  })

  it('does not flag a nested loop whose equality stayed in the index condition', () => {
    const plan = {
      'Node Type': 'Nested Loop',
      'Plan Rows': 500,
      Plans: [
        clamped_join(),
        { 'Node Type': 'Index Scan', 'Plan Rows': 1, 'Index Cond': 'a = b' }
      ]
    }
    expect(plan_carries_clamp_signature(plan)).to.equal(false)
  })

  // A one-row estimate on a SCAN is ordinary and correct -- a unique index
  // lookup returns one row. Only a JOIN estimated at one row is the residue of
  // a selectivity that came out below one and got clamped.
  it('does not treat a one-row scan as a clamp', () => {
    const plan = filtered_nested_loop({
      children: [
        { 'Node Type': 'Index Scan', 'Plan Rows': 1, 'Index Cond': 'pid = $1' },
        scan()
      ]
    })
    expect(plan_carries_clamp_signature(plan)).to.equal(false)
  })

  it('reads merge and nested-loop joins as clamp carriers too', () => {
    for (const node_type of ['Merge Join', 'Nested Loop']) {
      const plan = filtered_nested_loop({
        children: [clamped_join({ node_type }), scan()]
      })
      expect(
        plan_carries_clamp_signature(plan),
        `${node_type} clamped to one row`
      ).to.equal(true)
    }
  })

  // The probe must never be able to fail a request that would otherwise run, so
  // every unrecognised shape has to answer "use the default planner".
  describe('unwrapping the EXPLAIN response', () => {
    it('reads the plan out of a well-formed response', () => {
      const plan = clamped_join()
      const response = { rows: [{ 'QUERY PLAN': [{ Plan: plan }] }] }
      expect(extract_plan_from_explain_response(response)).to.equal(plan)
    })

    for (const [label, response] of [
      ['undefined', undefined],
      ['no rows', {}],
      ['empty rows', { rows: [] }],
      ['no QUERY PLAN column', { rows: [{ other: 1 }] }],
      ['QUERY PLAN not an array', { rows: [{ 'QUERY PLAN': 'text plan' }] }],
      ['empty QUERY PLAN array', { rows: [{ 'QUERY PLAN': [] }] }]
    ]) {
      it(`answers null for ${label}`, () => {
        expect(extract_plan_from_explain_response(response)).to.equal(null)
      })
    }
  })

  for (const [label, value] of [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Nested Loop']
  ]) {
    it(`does not flag ${label}`, () => {
      expect(plan_carries_clamp_signature(value)).to.equal(false)
    })
  }
})
