/* global describe it */
import * as chai from 'chai'

import weightProjections from '#libs-shared/weight-projections.mjs'

const expect = chai.expect

// The consensus source ("Average", source_id 18) is what the entire value
// pipeline consumes, and it used to coalesce "no source has an opinion" to 0.0.
// That is indistinguishable downstream from "every source agrees on zero", and
// it is how four of the twelve DST scoring components -- three-and-outs,
// fourth-down stops, points-against and yards-against, which NO vendor supplies
// -- came to be projected as exactly 0.0 across all 32 defenses. The resulting
// DST board fits at r = 0.08 against realized outcomes.
//
// The same function separately DROPPED a genuine zero from a source, via a
// truthiness guard, so a stat two of three sources projected at zero averaged to
// the third source's number rather than to a third of it.
//
// Neither defect fails anything. Both produce a confident, wrong number.

const build_projection = (source_id, stats) => ({
  source_id,
  week: 0,
  ...stats
})

describe('LIBS-SHARED weightProjections', function () {
  it('leaves a stat absent when no source has an opinion', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, { passing_yards: 4000 }),
        build_projection(6, { passing_yards: 4200 })
      ],
      week: 0
    })

    expect(result.passing_yards).to.equal(4100)
    // No source supplied these; they must not read as a consensus of zero.
    expect(result.defensive_points_against).to.equal(null)
    expect(result.defensive_three_and_outs).to.equal(null)
    expect(result.punt_return_touchdowns).to.equal(null)
  })

  it('averages a genuine zero rather than dropping it', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, { rushing_yards: 400, rushing_touchdowns: 0 }),
        build_projection(6, { rushing_yards: 380, rushing_touchdowns: 0 }),
        build_projection(28, { rushing_yards: 420, rushing_touchdowns: 9 })
      ],
      week: 0
    })

    // Two sources say zero and one says nine. The consensus is three, not nine.
    expect(result.rushing_touchdowns).to.equal(3)
  })

  it('reports zero when every source genuinely projects zero', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, { receiving_yards: 300, receiving_touchdowns: 0 }),
        build_projection(6, { receiving_yards: 320, receiving_touchdowns: 0 })
      ],
      week: 0
    })

    // Distinct from the absent case above: this IS a consensus.
    expect(result.receiving_touchdowns).to.equal(0)
  })

  it('ignores an all-zero placeholder row', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, { passing_yards: 3900, passing_touchdowns: 26 }),
        build_projection(6, { passing_yards: 3700, passing_touchdowns: 25 }),
        // NFL (source 4) carried exactly one 2026 QB row and every stat in it
        // was 0.0. Averaging it in dropped Josh Allen from QB1 to QB10.
        build_projection(4, { passing_yards: 0, passing_touchdowns: 0 })
      ],
      week: 0
    })

    expect(result.passing_yards).to.equal(3800)
    expect(result.passing_touchdowns).to.equal(25.5)
  })

  it('keeps a zero that sits alongside a real projection', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, {
          passing_yards: 4000,
          rushing_touchdowns: 0
        }),
        build_projection(6, {
          passing_yards: 3800,
          rushing_touchdowns: 4
        })
      ],
      week: 0
    })

    // Source 3 has an opinion about this quarterback and it is that he will not
    // run one in. That is not a placeholder.
    expect(result.rushing_touchdowns).to.equal(2)
  })

  it('honors source weights', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, { receiving_yards: 1000 }),
        build_projection(6, { receiving_yards: 500 })
      ],
      weights: [
        { uid: 3, weight: 3 },
        { uid: 6, weight: 1 }
      ],
      week: 0
    })

    expect(result.receiving_yards).to.equal(875)
  })

  it('ignores the AVERAGE source itself and other weeks', function () {
    const result = weightProjections({
      projections: [
        build_projection(3, { rushing_yards: 800 }),
        // source_id 18 is the consensus this function PRODUCES; folding it back
        // in would compound it against itself on every run.
        build_projection(18, { rushing_yards: 5000 }),
        { source_id: 3, week: 1, rushing_yards: 50 }
      ],
      week: 0
    })

    expect(result.rushing_yards).to.equal(800)
  })
})
