/* global describe it */
import * as chai from 'chai'

import calibrate_projected_points, {
  projection_calibration_trust_floor
} from '#libs-shared/calibrate-projected-points.mjs'

const expect = chai.expect

// Calibration is the mechanism that converts "no information" into "no
// dollars". Before it existed, a DST board fitting at r = 0.08 -- statistically
// close to a random ordering -- was published as a confident ranking, and the
// value pipeline priced it as though the spread were real.
//
// The trust floor is the load-bearing behaviour here and it is the one a future
// change is most likely to quietly break, because collapsing a position looks
// like a bug unless you know why it is there.

const build_player = (pid, primary_position, total, week = 0) => ({
  pid,
  primary_position,
  points: { [week]: { total } }
})

describe('LIBS-SHARED calibrate_projected_points', function () {
  it('applies intercept + slope x projected above the trust floor', function () {
    const players = [build_player('a', 'QB', 300), build_player('b', 'QB', 200)]

    calibrate_projected_points({
      players,
      calibration: { QB: { slope: 0.75, intercept: 40, r: 0.5 } },
      week: 0
    })

    expect(players[0].points[0].total).to.equal(265)
    expect(players[1].points[0].total).to.equal(190)
  })

  it('preserves the vendor projection as projected_total', function () {
    const players = [build_player('a', 'RB', 200)]

    calibrate_projected_points({
      players,
      calibration: { RB: { slope: 0.9, intercept: 5, r: 0.6 } },
      week: 0
    })

    expect(players[0].points[0].projected_total).to.equal(200)
    expect(players[0].points[0].total).to.equal(185)
  })

  it('collapses a position to zero spread below the trust floor', function () {
    // Three defenses the projection claims to rank, on a board it cannot
    // actually order. Every one must come out identical, so pts_added is zero
    // and the position prices at $0 -- not because defenses are worthless, but
    // because we cannot tell them apart.
    const players = [
      build_player('HOU', 'DST', 112),
      build_player('DEN', 'DST', 104),
      build_player('CAR', 'DST', 97)
    ]

    calibrate_projected_points({
      players,
      calibration: {
        DST: {
          slope: 0.31,
          intercept: 76.7,
          r: projection_calibration_trust_floor - 0.01
        }
      },
      week: 0
    })

    const totals = players.map((p) => p.points[0].total)
    expect(totals[0]).to.equal(totals[1])
    expect(totals[1]).to.equal(totals[2])
    // Collapsed onto the position mean, not onto zero.
    expect(totals[0]).to.be.closeTo(76.7 + 0.31 * ((112 + 104 + 97) / 3), 1e-9)
  })

  it('keeps the spread exactly at the trust floor', function () {
    const players = [
      build_player('a', 'DST', 120),
      build_player('b', 'DST', 100)
    ]

    calibrate_projected_points({
      players,
      calibration: {
        DST: {
          slope: 0.5,
          intercept: 50,
          r: projection_calibration_trust_floor
        }
      },
      week: 0
    })

    expect(players[0].points[0].total).to.equal(110)
    expect(players[1].points[0].total).to.equal(100)
  })

  it('leaves the board untouched when the format is unfitted', function () {
    const players = [build_player('a', 'WR', 180)]

    calibrate_projected_points({ players, calibration: null, week: 0 })

    // An unfitted format must price as it did before calibration existed,
    // rather than refusing to price at all.
    expect(players[0].points[0].total).to.equal(180)
    expect(players[0].points[0].projected_total).to.equal(undefined)
  })

  it('leaves a position with no fitted row untouched', function () {
    const players = [build_player('a', 'WR', 180), build_player('b', 'TE', 90)]

    calibrate_projected_points({
      players,
      calibration: { WR: { slope: 0.9, intercept: 4, r: 0.5 } },
      week: 0
    })

    expect(players[0].points[0].total).to.equal(166)
    expect(players[1].points[0].total).to.equal(90)
  })

  it('skips a player with no projection for the week', function () {
    const players = [build_player('a', 'RB', 200, 0)]

    calibrate_projected_points({
      players,
      calibration: { RB: { slope: 0.9, intercept: 5, r: 0.6 } },
      week: 3
    })

    expect(players[0].points[0].total).to.equal(200)
    expect(players[0].points[3]).to.equal(undefined)
  })
})
