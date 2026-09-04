/* global describe it */
import * as chai from 'chai'

import {
  plan_carries_clamp_signature,
  extract_plan_from_explain_response
} from '#libs-server/data-views/nested-loop-clamp-signature.mjs'

const expect = chai.expect

// This detector decides, per statement, whether the executor ships
// `enable_nestloop = off`. It is the entire remedy for the line-axis prop views
// -- the worst of them measured 53,033ms on the default plan and 505ms on the
// forced arm -- and it shipped with no test at all.
//
// What makes it worth pinning is that BOTH halves of the conjunction are load
// bearing in opposite directions. Losing the `Plan Rows === 1` half would select
// nearly every statement, and a blanket `enable_nestloop = off` was measured
// taking a small view from 851ms to 9,198ms. Losing the `Join Filter` half would
// deselect the shapes the arm exists for. A regression in either direction is a
// production latency change with no other alarm attached to it, so each half
// gets a case that fails if only that half is dropped.
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
    // the arrangement the loose conjunction was chosen for: requiring the
    // clamped join to sit inside the filtered loop's outer subtree was measured
    // selecting 105 statements against this rule's 107.
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

  it('does not select a clamped plan whose nested loops carry no join filter', function () {
    // A clamped join alone is not the pathology -- the rescan needs an equality
    // that was demoted out of the index condition and is re-checked per inner
    // row. Without it the loop is doing the work the planner expects.
    const plan = {
      'Node Type': 'Limit',
      'Plan Rows': 500,
      Plans: [clamped_join({ Plans: [leaf(), leaf()] }), leaf()]
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
