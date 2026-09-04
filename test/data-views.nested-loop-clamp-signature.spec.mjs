/* global describe it */
import * as chai from 'chai'

import {
  plan_carries_clamp_signature,
  extract_plan_from_explain_response
} from '#libs-server/data-views/nested-loop-clamp-signature.mjs'

const expect = chai.expect

// The module header explains why both halves of the conjunction are load
// bearing in opposite directions. What it cannot say is that a regression in
// either direction changes production latency with no other alarm attached, so
// each half gets a case that fails if only that half is dropped.
//
// The fixtures below are reduced from a real 2026-09-04 production plan for the
// saved view "2024 - Receiving Yard Props (Weekly)" (slow_query signature
// 574beb6a7296ead7). In the full plan three subquery scans estimated at one row
// returned 1,812 / 1,679 / 11,764 rows and were rescanned 11,867 times behind
// Join Filters that discarded roughly 182 million rows to return 500. Only the
// two properties the detector reads are kept here; the rest is noise it must not
// depend on.
const nested_loop_with_join_filter = (overrides = {}) => ({
  'Node Type': 'Nested Loop',
  'Plan Rows': 11867,
  'Join Filter': '((pms.selection_pid)::text = (player.pid)::text)',
  ...overrides
})

const clamped_join = (overrides = {}) => ({
  'Node Type': 'Nested Loop',
  'Plan Rows': 1,
  ...overrides
})

const leaf = (node_type = 'Index Scan') => ({
  'Node Type': node_type,
  'Plan Rows': 500
})

describe('data views nested-loop clamp signature', function () {
  it('selects the line-axis prop shape the forced hash-join arm exists for', function () {
    // The clamp and the filtered loop sit in DIFFERENT subtrees here, which is
    // the arrangement the module header's loose conjunction was chosen for.
    const plan = {
      'Node Type': 'Limit',
      'Plan Rows': 500,
      Plans: [
        {
          'Node Type': 'Merge Left Join',
          'Plan Rows': 10046,
          Plans: [nested_loop_with_join_filter({ Plans: [leaf(), leaf()] })]
        },
        clamped_join({ Plans: [leaf(), leaf('Bitmap Heap Scan')] })
      ]
    }

    expect(plan_carries_clamp_signature(plan)).to.equal(true)
  })

  it('does not select a plan whose only clamped node is not a join', function () {
    // A scan estimated at one row is ordinary and everywhere. Reading `Plan
    // Rows === 1` off any node rather than off a JOIN node is the cheapest way
    // to widen this detector into the blanket setting it was built to avoid.
    const plan = {
      'Node Type': 'Limit',
      'Plan Rows': 500,
      Plans: [
        nested_loop_with_join_filter({
          Plans: [
            { 'Node Type': 'Index Scan', 'Plan Rows': 1 },
            { 'Node Type': 'Bitmap Heap Scan', 'Plan Rows': 1 }
          ]
        })
      ]
    }

    expect(plan_carries_clamp_signature(plan)).to.equal(false)
  })

  it('reads a clamp off a Hash Join and a Merge Join, not only a Nested Loop', function () {
    // Postgres clamps any join estimate to 1, and the residue is worth acting on
    // wherever it appears -- but the FILTER half is deliberately Nested-Loop
    // only, since that is the operator that rescans.
    for (const node_type of ['Hash Join', 'Merge Join']) {
      const plan = {
        'Node Type': 'Limit',
        'Plan Rows': 500,
        Plans: [
          { 'Node Type': node_type, 'Plan Rows': 1, Plans: [leaf(), leaf()] },
          nested_loop_with_join_filter({ Plans: [leaf(), leaf()] })
        ]
      }

      expect(plan_carries_clamp_signature(plan), node_type).to.equal(true)
    }
  })

  it('ignores a Join Filter on a node that is not a Nested Loop', function () {
    const plan = {
      'Node Type': 'Limit',
      'Plan Rows': 500,
      Plans: [
        clamped_join({ Plans: [leaf(), leaf()] }),
        {
          'Node Type': 'Hash Join',
          'Plan Rows': 10046,
          'Join Filter': '((a.id)::text = (b.id)::text)',
          Plans: [leaf(), leaf()]
        }
      ]
    }

    expect(plan_carries_clamp_signature(plan)).to.equal(false)
  })

  it('answers false rather than throwing on a plan it cannot read', function () {
    // The probe runs in front of every data-view execution, so it must never be
    // able to fail a request that would otherwise have run.
    for (const input of [null, undefined, 'not a plan', 42]) {
      expect(plan_carries_clamp_signature(input), String(input)).to.equal(false)
    }
  })

  describe('extract_plan_from_explain_response', function () {
    it('unwraps the one-row one-column shape EXPLAIN (FORMAT JSON) returns', function () {
      const plan = clamped_join()
      const response = { rows: [{ 'QUERY PLAN': [{ Plan: plan }] }] }

      expect(extract_plan_from_explain_response(response)).to.equal(plan)
    })

    it('answers null for every malformed response rather than throwing', function () {
      const malformed = [
        undefined,
        null,
        {},
        { rows: [] },
        { rows: [{}] },
        { rows: [{ 'QUERY PLAN': null }] },
        { rows: [{ 'QUERY PLAN': 'not an array' }] },
        { rows: [{ 'QUERY PLAN': [] }] },
        { rows: [{ 'QUERY PLAN': [{}] }] }
      ]

      for (const response of malformed) {
        expect(
          extract_plan_from_explain_response(response),
          JSON.stringify(response)
        ).to.equal(null)
      }
    })
  })
})
