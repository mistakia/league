/* global describe it */
import * as chai from 'chai'

import calculate_distributional_baselines, {
  build_league_starting_slots,
  fill_starting_slots
} from '#libs-shared/calculate-distributional-baselines.mjs'
import calculate_projection_dispersion, {
  sample_standard_deviation,
  realized_to_vendor_dispersion_ratio
} from '#libs-shared/calculate-projection-dispersion.mjs'

const expect = chai.expect

// A two-team league: one QB, one RB, one WR, one TE and one superflex per team.
const two_team_league = {
  num_teams: 2,
  sqb: 1,
  srb: 1,
  swr: 1,
  ste: 1,
  swrte: 0,
  srbwr: 0,
  srbwrte: 0,
  sqbrbwrte: 1,
  sk: 0,
  sdst: 0
}

const make_player = ({ pid, position, total, points_sd = 0, week = 0 }) => ({
  pid,
  primary_position: position,
  points: { [week]: { total, points_sd } }
})

// Deterministic uniform source. Box-Muller rejects samples outside the unit
// circle, so a cycling generator keeps specs reproducible without pinning to a
// particular deviate.
const make_sequence_random = (values) => {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index++
    return value
  }
}

describe('LIBS-SHARED calculate-projection-dispersion', function () {
  it('is the sample standard deviation of the source totals', () => {
    expect(sample_standard_deviation([10, 20])).to.be.closeTo(7.0711, 0.0001)
    expect(sample_standard_deviation([5, 5, 5])).to.equal(0)
  })

  it('returns zero for fewer than two observations', () => {
    expect(sample_standard_deviation([])).to.equal(0)
    expect(sample_standard_deviation([42])).to.equal(0)
  })

  it('substitutes the position median when a player is under-covered', () => {
    const rb_ratio = realized_to_vendor_dispersion_ratio.RB
    const { dispersion_by_pid, median_by_position } =
      calculate_projection_dispersion({
        source_totals_by_pid: {
          covered_a: [100, 120], // vendor sd 14.142
          covered_b: [200, 210], // vendor sd  7.071
          covered_c: [300, 340], // vendor sd 28.284
          thin: [150]
        },
        position_by_pid: {
          covered_a: 'RB',
          covered_b: 'RB',
          covered_c: 'RB',
          thin: 'RB'
        }
      })

    expect(median_by_position.RB).to.be.closeTo(14.142 * rb_ratio, 0.001)
    expect(dispersion_by_pid.thin).to.equal(median_by_position.RB)
    expect(dispersion_by_pid.covered_b).to.be.closeTo(7.071 * rb_ratio, 0.001)
  })

  it('takes the median from the player’s own position', () => {
    const { dispersion_by_pid } = calculate_projection_dispersion({
      source_totals_by_pid: {
        qb_one: [300, 400], // QB vendor sd 70.71
        te_one: [100, 110], // TE vendor sd  7.07
        te_thin: [105]
      },
      position_by_pid: { qb_one: 'QB', te_one: 'TE', te_thin: 'TE' }
    })
    expect(dispersion_by_pid.te_thin).to.be.closeTo(
      7.071 * realized_to_vendor_dispersion_ratio.TE,
      0.001
    )
  })

  // The output is the estimated dispersion of the REALIZED season, not the
  // vendor spread. Sources cluster, so the two differ by a measured per-position
  // factor and the model draws from the second. Pinned per position because a
  // single shared scalar would silently erase the positional structure the
  // measurement found.
  it('rescales the vendor spread by the measured per-position ratio', () => {
    const { dispersion_by_pid } = calculate_projection_dispersion({
      source_totals_by_pid: {
        qb: [100, 120],
        rb: [100, 120],
        wr: [100, 120],
        te: [100, 120],
        dst: [100, 120]
      },
      position_by_pid: {
        qb: 'QB',
        rb: 'RB',
        wr: 'WR',
        te: 'TE',
        dst: 'DST'
      }
    })

    const vendor_sd = sample_standard_deviation([100, 120])
    for (const [pid, position] of [
      ['qb', 'QB'],
      ['rb', 'RB'],
      ['wr', 'WR'],
      ['te', 'TE'],
      ['dst', 'DST']
    ]) {
      expect(dispersion_by_pid[pid]).to.be.closeTo(
        vendor_sd * realized_to_vendor_dispersion_ratio[position],
        0.001
      )
    }
  })

  // Every ratio must stay inside the band the measurement reported. A value
  // drifting outside it means someone tuned the constant rather than re-measured
  // it, which is the failure this guards.
  it('keeps every measured ratio inside the reported 4.2-4.6 band', () => {
    for (const ratio of Object.values(realized_to_vendor_dispersion_ratio)) {
      expect(ratio).to.be.within(4.2, 4.6)
    }
  })
})

describe('LIBS-SHARED calculate-distributional-baselines', function () {
  describe('build_league_starting_slots', function () {
    it('repeats the configured starting slots once per team', () => {
      const slots = build_league_starting_slots({ league: two_team_league })
      expect(slots).to.have.lengthOf(10)
      expect(slots.filter((slot) => slot === 'QB')).to.have.lengthOf(2)
      expect(slots.filter((slot) => slot === 'QBRBWRTE')).to.have.lengthOf(2)
    })

    it('excludes bench, practice squad and reserve', () => {
      const slots = build_league_starting_slots({
        league: {
          ...two_team_league,
          bench: 6,
          ps: 4,
          reserve_short_term_limit: 3
        }
      })
      expect(slots).to.have.lengthOf(10)
    })
  })

  describe('fill_starting_slots', function () {
    it('seats the highest scorers and reports the worst starter per position', () => {
      const baseline = fill_starting_slots({
        values: [300, 200, 100],
        positions: ['RB', 'RB', 'RB'],
        slots: ['RB', 'RB']
      })
      expect(baseline.RB).to.equal(200)
    })

    it('lets a flex slot absorb a surplus player from another position', () => {
      // Two RB slots and one RB/WR flex. Three RBs and one WR; the WR outscores
      // the third RB, so the flex should take the WR.
      const baseline = fill_starting_slots({
        values: [300, 250, 90, 150],
        positions: ['RB', 'RB', 'RB', 'WR'],
        slots: ['RB', 'RB', 'RBWR']
      })
      expect(baseline.RB).to.equal(250)
      expect(baseline.WR).to.equal(150)
    })

    it('displaces an earlier player rather than rejecting a seatable one', () => {
      // The single QB slot and the superflex are both eligible for the QB. The
      // top QB is offered first and must end up in one of them while the second
      // QB takes the other -- a naive first-open-slot fill that never
      // reconsiders would still work here, so make the RB contest the superflex:
      // RB(400) is offered first and takes the superflex, then QB(300) and
      // QB(250) both need seats and only QB slot remains. QB(250) is rejected.
      const baseline = fill_starting_slots({
        values: [400, 300, 250],
        positions: ['RB', 'QB', 'QB'],
        slots: ['QB', 'QBRBWRTE']
      })
      expect(baseline.QB).to.equal(300)
      expect(baseline.RB).to.equal(400)
    })

    it('omits a position that seats nobody', () => {
      const baseline = fill_starting_slots({
        values: [100],
        positions: ['WR'],
        slots: ['QB']
      })
      expect(baseline.WR).to.equal(undefined)
      expect(baseline.QB).to.equal(undefined)
    })
  })

  describe('expectations over draws', function () {
    // Fourteen players for ten starting slots, so replacement level is a real
    // cut rather than "everybody starts". Descending, the ten seated are
    // qb1 400, qb2 300, rb1 250, wr1 240, qb3 200, rb2 200, wr2 190, te1 180,
    // rb3 150 and te2 120 -- the two superflex slots taking qb3 and rb3.
    // Replacement lands at QB 200, RB 150, WR 190, TE 120.
    const flat_board = [
      make_player({ pid: 'qb1', position: 'QB', total: 400 }),
      make_player({ pid: 'qb2', position: 'QB', total: 300 }),
      make_player({ pid: 'qb3', position: 'QB', total: 200 }),
      make_player({ pid: 'qb4', position: 'QB', total: 100 }),
      make_player({ pid: 'rb1', position: 'RB', total: 250 }),
      make_player({ pid: 'rb2', position: 'RB', total: 200 }),
      make_player({ pid: 'rb3', position: 'RB', total: 150 }),
      make_player({ pid: 'rb4', position: 'RB', total: 50 }),
      make_player({ pid: 'wr1', position: 'WR', total: 240 }),
      make_player({ pid: 'wr2', position: 'WR', total: 190 }),
      make_player({ pid: 'wr3', position: 'WR', total: 60 }),
      make_player({ pid: 'te1', position: 'TE', total: 180 }),
      make_player({ pid: 'te2', position: 'TE', total: 120 }),
      make_player({ pid: 'te3', position: 'TE', total: 40 })
    ]

    // The invariant that ties this module to the one it replaces: with no
    // dispersion every draw is the point-estimate board, so the expected
    // baseline must be exactly the point-estimate baseline and the expected
    // surplus exactly max(points - baseline, 0).
    it('reduces to the point estimate when dispersion is zero', () => {
      const { baselines, expected_surplus, total_pts_added } =
        calculate_distributional_baselines({
          players: flat_board,
          league: two_team_league,
          week: 0,
          draws: 5
        })

      expect(baselines.QB).to.equal(200)
      expect(baselines.RB).to.equal(150)
      expect(baselines.WR).to.equal(190)
      expect(baselines.TE).to.equal(120)

      expect(expected_surplus.qb1).to.equal(200)
      expect(expected_surplus.qb2).to.equal(100)
      expect(expected_surplus.qb3).to.equal(0)
      // Below replacement floors at zero rather than going negative.
      expect(expected_surplus.qb4).to.equal(0)
      expect(expected_surplus.te2).to.equal(0)
      expect(expected_surplus.te1).to.equal(60)

      expect(total_pts_added).to.equal(560)
      const summed = Object.values(expected_surplus).reduce((t, v) => t + v, 0)
      expect(total_pts_added).to.be.closeTo(summed, 1e-9)
    })

    it('is deterministic for a given random source', () => {
      const run = () =>
        calculate_distributional_baselines({
          players: flat_board.map((player) => ({
            ...player,
            points: { 0: { total: player.points[0].total, points_sd: 40 } }
          })),
          league: two_team_league,
          week: 0,
          draws: 50,
          random: make_sequence_random([0.11, 0.37, 0.68, 0.92, 0.24, 0.55])
        })
      const first = run()
      const second = run()
      expect(first.baselines).to.deep.equal(second.baselines)
      expect(first.expected_surplus).to.deep.equal(second.expected_surplus)
    })

    // The payoff max(X - baseline, 0) is convex in X, so by Jensen the expected
    // payoff of a dispersed player is at least the payoff of his mean. This is
    // the whole reason the rebuild exists, so it is asserted directly.
    it('never values a dispersed player below his point estimate', () => {
      const dispersed = flat_board.map((player) => ({
        ...player,
        points: { 0: { total: player.points[0].total, points_sd: 45 } }
      }))

      const point_estimate = calculate_distributional_baselines({
        players: flat_board,
        league: two_team_league,
        week: 0,
        draws: 1
      })
      const drawn = calculate_distributional_baselines({
        players: dispersed,
        league: two_team_league,
        week: 0,
        draws: 4000
      })

      expect(drawn.total_pts_added).to.be.greaterThan(
        point_estimate.total_pts_added
      )
    })

    it('reports a null baseline for a position the league cannot fill', () => {
      const { baselines } = calculate_distributional_baselines({
        players: [make_player({ pid: 'qb1', position: 'QB', total: 400 })],
        league: two_team_league,
        week: 0,
        draws: 3
      })
      expect(baselines.DST).to.equal(null)
    })

    it('ignores players with no projection for the week', () => {
      const { expected_surplus } = calculate_distributional_baselines({
        players: [
          ...flat_board,
          make_player({ pid: 'absent', position: 'RB', total: 0 })
        ],
        league: two_team_league,
        week: 0,
        draws: 3
      })
      expect(expected_surplus).to.not.have.property('absent')
    })

    it('treats a missing points_sd as zero rather than NaN', () => {
      const { baselines, total_pts_added } = calculate_distributional_baselines(
        {
          players: flat_board.map((player) => ({
            ...player,
            points: { 0: { total: player.points[0].total } }
          })),
          league: two_team_league,
          week: 0,
          draws: 3
        }
      )
      expect(baselines.QB).to.equal(200)
      expect(Number.isFinite(total_pts_added)).to.equal(true)
    })
  })
})
