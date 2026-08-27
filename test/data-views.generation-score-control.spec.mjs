/* global describe it */
import * as chai from 'chai'

import {
  score_table_state,
  build_report,
  column_count_bucket,
  param_family_buckets
} from '#scripts/score-data-view-generation.mjs'

const { expect } = chai

// The negative control on the generation score, held to the same standard the
// score holds the model to: it has to be shown going red.
//
// The control it replaced was vacuous for a whole session. It appended "ignore
// the catalog, invent whatever ids seem reasonable" to the user-side catalog
// block while the system prompt still said to use catalog ids verbatim, so the
// model obeyed the system prompt and the control run WAS the real run. It read
// as a working control the entire time, because a control that cannot report is
// indistinguishable from one that reports nothing to report.
//
// So the cases below are a pair. A generator that answers the request must clear
// the margin, and a generator that ignores the request must fail to clear it. A
// suite that only ran the first would pass on a control wired to a constant.

const view = ({ columns }) => ({
  columns: columns.map((column_id) => ({ column_id }))
})

const build_results = ({ pairs }) =>
  pairs.map(([view_name, expected, generated]) => ({
    view_id: view_name,
    view_name,
    outcome: 'resolved',
    error: null,
    error_message: null,
    generated,
    expected,
    expected_column_count: expected.columns.length,
    column_count_bucket: column_count_bucket(expected.columns.length),
    param_families: param_family_buckets(expected),
    score: score_table_state({ generated, expected })
  }))

// Three distinct human views. Distinct matters: the control pairs each
// generation with the NEXT view's original, so overlapping originals would let
// a mispaired score ride on columns the views happen to share.
const originals = [
  view({
    columns: ['player_name', 'player_receiving_yards', 'player_targets']
  }),
  view({ columns: ['team_code', 'team_pass_yards', 'team_rush_yards'] }),
  view({ columns: ['player_name', 'player_snap_share', 'player_route_rate'] })
]

describe('data view generation score / negative control', () => {
  it('clears the margin when the generator answers the request', () => {
    const report = build_report({
      results: build_results({
        pairs: originals.map((original, index) => [
          `view-${index}`,
          original,
          original
        ])
      })
    })

    expect(report.overall.mean).to.equal(1)
    expect(report.control.mispaired.mean).to.be.below(report.overall.mean)
    expect(report.control.margin).to.be.at.least(report.control.minimum_margin)
    expect(report.control.discriminates).to.equal(true)
  })

  it('fails the margin when the generator ignores the request', () => {
    // The same answer for every request. It cannot be right about which view was
    // asked for, so a score that still reports a margin is measuring something
    // other than whether the view is right.
    const constant_answer = view({
      columns: ['player_name', 'player_position', 'player_games_played']
    })

    const report = build_report({
      results: build_results({
        pairs: originals.map((original, index) => [
          `view-${index}`,
          original,
          constant_answer
        ])
      })
    })

    expect(report.control.margin).to.be.below(report.control.minimum_margin)
    expect(report.control.discriminates).to.equal(false)
  })

  it('cannot manufacture a margin out of failed generations', () => {
    // A fall-through scores zero against its own view. It must also score zero
    // mispaired, or a run that generated nothing at all would report a margin.
    const report = build_report({
      results: originals.map((expected, index) => ({
        view_id: `view-${index}`,
        view_name: `view-${index}`,
        outcome: 'inexpressible',
        error: null,
        error_message: null,
        generated: null,
        expected,
        expected_column_count: expected.columns.length,
        column_count_bucket: column_count_bucket(expected.columns.length),
        param_families: param_family_buckets(expected),
        score: { columns: 0, where: 0, params: 0, overall: 0 }
      }))
    })

    expect(report.overall.mean).to.equal(0)
    expect(report.control.mispaired.mean).to.equal(0)
    expect(report.control.margin).to.equal(0)
    expect(report.control.discriminates).to.equal(false)
  })
})
