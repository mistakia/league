/* global describe it before after */

import MockDate from 'mockdate'
import * as chai from 'chai'

import {
  get_data_view_results_query,
  load_data_view_test_queries_sync
} from '#libs-server'
import { pin_golden_clock, restore_suite_clock } from './utils/index.mjs'

const { expect } = chai

// Two ambient clocks that the data-view emitters genuinely disagree under: one
// preseason, one deep in the following offseason, so they differ in season
// type, resolved week AND current season year. Neither is GOLDEN_CLOCK -- a
// control that happened to sit on the pinned instant would prove nothing.
const PRESEASON_CLOCK = '2026-08-15T12:00:00Z'
const OFFSEASON_CLOCK = '2027-03-01T12:00:00Z'

const fixtures = load_data_view_test_queries_sync()

const emit_corpus = async () => {
  const emitted = {}
  for (const fixture of fixtures) {
    try {
      const { query } = await get_data_view_results_query(fixture.request)
      emitted[fixture.filename] = query.toString()
    } catch (error) {
      // A fixture that cannot generate is not this spec's business -- record
      // the failure text so it compares equal across clocks like any other
      // output, rather than aborting the sweep and shrinking the denominator.
      emitted[fixture.filename] = `error: ${error.message}`
    }
  }
  return emitted
}

const names_that_differ = (left, right) =>
  Object.keys(left).filter((name) => left[name] !== right[name])

describe('data views: golden clock invariance', function () {
  this.timeout(240000)

  let pinned_at_preseason
  let pinned_at_offseason
  let free_at_preseason
  let free_at_offseason

  before(async () => {
    MockDate.set(PRESEASON_CLOCK)
    pin_golden_clock()
    pinned_at_preseason = await emit_corpus()

    MockDate.set(OFFSEASON_CLOCK)
    pin_golden_clock()
    pinned_at_offseason = await emit_corpus()

    MockDate.set(PRESEASON_CLOCK)
    free_at_preseason = await emit_corpus()

    MockDate.set(OFFSEASON_CLOCK)
    free_at_offseason = await emit_corpus()
  })

  after(() => {
    restore_suite_clock()
  })

  // The control, and it runs FIRST because everything below is vacuous without
  // it. If the emitters ever stopped reading the clock, the invariance
  // assertion would pass over a harness that had stopped pinning anything --
  // the shape this repo's verification rule exists for. This asserts the
  // corpus can still tell two clocks apart at all.
  it('the corpus is genuinely clock-sensitive without the pin', () => {
    const drifting = names_that_differ(free_at_preseason, free_at_offseason)
    expect(
      drifting.length,
      'no fixture emitted different SQL under two very different clocks, so the invariance assertion below cannot fail and proves nothing'
    ).to.be.greaterThan(0)
  })

  it('emits identical SQL under the pin whatever the ambient clock', () => {
    const drifting = names_that_differ(pinned_at_preseason, pinned_at_offseason)
    expect(
      drifting,
      `these goldens still move with the wall clock under the pin: ${drifting.join(', ')}`
    ).to.deep.equal([])
  })

  // The other way a golden's expected side moves with the clock, and the one
  // that reads as a fix. `expected_query` was evaluated as a template literal
  // with the season constants in scope, so a fixture could interpolate the
  // current week and track the emitter across a rollover. It stopped the churn
  // and paid for it in coverage: both sides then derived from one call, so the
  // fixture could no longer fail on a change to the derivation itself. With
  // the clock pinned the literal is stable on its own and the template is
  // strictly worse, so it must not come back.
  it('no fixture interpolates a clock-derived value into its expected SQL', () => {
    const templated = fixtures
      .filter(
        (fixture) =>
          fixture.expected_query && fixture.expected_query.includes('${')
      )
      .map((fixture) => fixture.filename)

    expect(
      templated,
      `expected_query is compared literally under a pinned clock; these fixtures interpolate instead: ${templated.join(', ')}`
    ).to.deep.equal([])
  })
})
