/* global describe it */
import * as chai from 'chai'

import { calculate_hit_rate } from '#scripts/calculate-historical-hit-rates.mjs'

const expect = chai.expect

// The six GAME_ALT_* types carry no selection_metric_line at all, so
// determine_selection_result refuses on every game in every sample. Scoring
// those refusals as misses produced a rate of exactly 0.0000 -- and a recompute
// wrote 22,444 such rows over a column that had been NULL, telling every reader
// the prop had never once hit on markets nobody had ever graded. That is the
// defect the corrected grader exists to remove, reappearing one layer down.
//
// The rule: a sample nothing could be graded in has NO rate. A sample where only
// SOME games refused still scores them as misses, per the ruling that a PUSH and
// an ungradable game both count against the denominator -- that ruling governs
// individual games inside a gradable sample, not a selection that cannot be
// graded at all.

describe('hit rate over an ungradable sample', function () {
  it('has no rate when every game refused', function () {
    expect(calculate_hit_rate({ hits: 0, total: 17, ungradable: 17 })).to.equal(
      null
    )
  })

  it('scores a partial refusal as a miss rather than dropping it', function () {
    expect(calculate_hit_rate({ hits: 4, total: 16, ungradable: 4 })).to.equal(
      0.25
    )
  })

  it('is a real zero when every game was graded and none hit', function () {
    expect(calculate_hit_rate({ hits: 0, total: 12, ungradable: 0 })).to.equal(
      0
    )
  })

  // The two zeros above are the whole point: one means "never hit" and the other
  // means "never graded", and before this change both rendered as 0.0000.
  it('distinguishes never-hit from never-graded', function () {
    const never_hit = calculate_hit_rate({ hits: 0, total: 12, ungradable: 0 })
    const never_graded = calculate_hit_rate({
      hits: 0,
      total: 12,
      ungradable: 12
    })

    expect(never_hit).to.not.equal(never_graded)
    expect(never_hit).to.equal(0)
    expect(never_graded).to.equal(null)
  })

  it('grades a full sample normally', function () {
    expect(calculate_hit_rate({ hits: 9, total: 12, ungradable: 0 })).to.equal(
      0.75
    )
  })
})
