/* global describe it */
import * as chai from 'chai'

import calculate_distributional_baselines, {
  build_league_starting_slots,
  default_draw_seed,
  fill_starting_slots,
  season_aggregate_key,
  assign_expected_surplus
} from '#libs-shared/calculate-distributional-baselines.mjs'
import { seeded_random } from '#libs-shared/seeded-random.mjs'
import calculate_projection_dispersion, {
  dispersion_model
} from '#libs-shared/calculate-projection-dispersion.mjs'

const expect = chai.expect

// A two-team league: one QB, one RB, one WR, one TE and one superflex per team.
const two_team_league = {
  number_teams: 2,
  starter_slots_quarterback: 1,
  starter_slots_running_back: 1,
  starter_slots_wide_receiver: 1,
  starter_slots_tight_end: 1,
  starter_slots_wide_receiver_tight_end_flex: 0,
  starter_slots_running_back_wide_receiver_flex: 0,
  starter_slots_running_back_wide_receiver_tight_end_flex: 0,
  starter_slots_superflex: 1,
  starter_slots_kicker: 0,
  starter_slots_defense_special_teams: 0
}

// Defaults to the SEASON key, because that is the board these two functions
// read. The fixture previously defaulted to week 0 and every call site passed
// `week: 0` to match -- which is why the whole suite stayed green while
// production wrote a full board of sentinels: the fixture encoded the retired
// key, so the input could not tell the old rule from the new one.
const make_player = ({
  pid,
  position,
  total,
  points_key = season_aggregate_key
}) => ({
  pid,
  primary_position: position,
  points: { [points_key]: { total } }
})

// Dispersion is derived from the board in production. These specs pin it so the
// draw arithmetic is checkable by hand.
const flat_dispersion = (players, value) =>
  Object.fromEntries(players.map((player) => [player.pid, value]))

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
  const board = [
    make_player({ pid: 'qb1', position: 'QB', total: 400 }),
    make_player({ pid: 'qb2', position: 'QB', total: 200 }),
    make_player({ pid: 'rb1', position: 'RB', total: 300 }),
    make_player({ pid: 'rb2', position: 'RB', total: 100 })
  ]

  // The scale anchor is the mean of the position's best `top_projection_count`
  // projections. With fewer players than that on the board it is the mean of
  // what is there, which is what makes the assertions below hand-checkable.
  it('anchors on the mean of the position’s top projections', () => {
    const { scale_by_position } = calculate_projection_dispersion({
      players: board,
      points_key: season_aggregate_key
    })
    expect(scale_by_position.QB).to.equal(300)
    expect(scale_by_position.RB).to.equal(200)
  })

  it('is affine in the projection, not proportional to it', () => {
    const { dispersion_by_pid } = calculate_projection_dispersion({
      players: board,
      points_key: season_aggregate_key
    })
    const { top_projection_share, projection_slope } = dispersion_model.QB

    expect(dispersion_by_pid.qb1).to.be.closeTo(
      top_projection_share * 300 + projection_slope * 400,
      0.001
    )
    expect(dispersion_by_pid.qb2).to.be.closeTo(
      top_projection_share * 300 + projection_slope * 200,
      0.001
    )

    // The defining property: halving the projection does NOT halve the
    // dispersion. A proportional model is the mistake this one replaced, so it
    // is asserted rather than left implied.
    expect(dispersion_by_pid.qb2 / dispersion_by_pid.qb1).to.be.greaterThan(0.5)
    expect(dispersion_by_pid.qb2).to.be.lessThan(dispersion_by_pid.qb1)
  })

  // Both terms are linear in the format's point scale, which is what makes the
  // constants dimensionless and lets one measurement serve every scoring format.
  // Doubling the whole board must double every dispersion exactly.
  it('scales linearly with the board, so it travels across scoring formats', () => {
    const single = calculate_projection_dispersion({
      players: board,
      points_key: season_aggregate_key
    })
    const doubled = calculate_projection_dispersion({
      players: board.map((player) => ({
        ...player,
        points: {
          [season_aggregate_key]: {
            total: player.points[season_aggregate_key].total * 2
          }
        }
      })),
      points_key: season_aggregate_key
    })

    for (const pid of Object.keys(single.dispersion_by_pid)) {
      expect(doubled.dispersion_by_pid[pid]).to.be.closeTo(
        single.dispersion_by_pid[pid] * 2,
        0.001
      )
    }
  })

  it('reads each position off its own scale', () => {
    const { dispersion_by_pid } = calculate_projection_dispersion({
      players: board,
      points_key: season_aggregate_key
    })
    expect(dispersion_by_pid.rb1).to.be.closeTo(
      dispersion_model.RB.top_projection_share * 200 +
        dispersion_model.RB.projection_slope * 300,
      0.001
    )
  })

  it('ignores players with no projection for the period', () => {
    const { dispersion_by_pid } = calculate_projection_dispersion({
      players: [
        ...board,
        make_player({ pid: 'absent', position: 'QB', total: 0 })
      ],
      points_key: season_aggregate_key
    })
    expect(dispersion_by_pid).to.not.have.property('absent')
  })

  // The control for the whole rename. A board published under the RETIRED week-0
  // key must come back empty rather than silently priced, because that is the
  // exact production shape that wrote 27,168 sentinel rows while every spec here
  // stayed green. Without this, the assertions above pass identically whether
  // the function reads the season key or the week.
  it('measures nothing when the board is published under the retired week key', () => {
    const { dispersion_by_pid, scale_by_position } =
      calculate_projection_dispersion({
        players: board.map((player) => ({
          ...player,
          points: { 0: player.points[season_aggregate_key] }
        })),
        points_key: season_aggregate_key
      })
    expect(Object.keys(dispersion_by_pid)).to.have.lengthOf(0)
    expect(Object.keys(scale_by_position)).to.have.lengthOf(0)
  })

  // A constant drifting outside the range the measurement reported across six
  // scoring formats means someone tuned it rather than re-measured it, which is
  // the failure this guards. Bands are the reported min/max widened slightly.
  it('keeps every constant inside the range the measurement reported', () => {
    const reported = {
      QB: {
        top_projection_share: [0.17, 0.23],
        projection_slope: [0.08, 0.15]
      },
      RB: {
        top_projection_share: [0.14, 0.16],
        projection_slope: [0.21, 0.24]
      },
      WR: {
        top_projection_share: [0.14, 0.16],
        projection_slope: [0.17, 0.19]
      },
      TE: {
        top_projection_share: [0.17, 0.19],
        projection_slope: [0.14, 0.17]
      },
      DST: { top_projection_share: [0.26, 0.28], projection_slope: [0.08, 0.1] }
    }
    for (const [position, bands] of Object.entries(reported)) {
      expect(dispersion_model[position].top_projection_share).to.be.within(
        ...bands.top_projection_share
      )
      expect(dispersion_model[position].projection_slope).to.be.within(
        ...bands.projection_slope
      )
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
          bench_slot_count: 6,
          practice_squad_slot_count: 4,
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
          draws: 5,
          dispersion_by_pid: flat_dispersion(flat_board, 0)
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
          players: flat_board,
          league: two_team_league,
          draws: 50,
          random: make_sequence_random([0.11, 0.37, 0.68, 0.92, 0.24, 0.55]),
          dispersion_by_pid: flat_dispersion(flat_board, 40)
        })
      const first = run()
      const second = run()
      expect(first.baselines).to.deep.equal(second.baselines)
      expect(first.expected_surplus).to.deep.equal(second.expected_surplus)
    })

    // The DEFAULT source must be seeded, which is a stronger claim than the
    // spec above: that one passes for any injected source and so said nothing
    // about production, which passes none. An unseeded default published a new
    // board on every hourly run with no input change behind it, and change-only
    // history recorded each re-roll as though a projection had moved.
    //
    // Guarded by a negative control, because a run that produced an empty pool
    // or a constant generator would satisfy the equality vacuously.
    it('is deterministic with no random source supplied', () => {
      const run = () =>
        calculate_distributional_baselines({
          players: flat_board,
          league: two_team_league,
          draws: 50,
          dispersion_by_pid: flat_dispersion(flat_board, 40)
        })

      const first = run()
      const second = run()

      // Negative control: the assertions below are only meaningful if the pool
      // is non-empty and the draws actually move the board off its means.
      expect(Object.keys(first.expected_surplus)).to.not.be.empty
      expect(first.total_pts_added).to.be.greaterThan(0)

      expect(first.baselines).to.deep.equal(second.baselines)
      expect(first.expected_surplus).to.deep.equal(second.expected_surplus)
      expect(first.expected_net_surplus).to.deep.equal(
        second.expected_net_surplus
      )
    })

    // The seed must reach the draws. Without this, a default that ignored its
    // seed entirely would pass the determinism spec above.
    it('produces a different board under a different seed', () => {
      const run = (random) =>
        calculate_distributional_baselines({
          players: flat_board,
          league: two_team_league,
          draws: 50,
          random,
          dispersion_by_pid: flat_dispersion(flat_board, 40)
        })

      const seeded = run(seeded_random(default_draw_seed))
      const alternate = run(seeded_random(default_draw_seed + 1))

      expect(seeded.expected_surplus).to.not.deep.equal(
        alternate.expected_surplus
      )
    })

    // The payoff max(X - baseline, 0) is convex in X, so by Jensen the expected
    // payoff of a dispersed player is at least the payoff of his mean. This is
    // the whole reason the rebuild exists, so it is asserted directly.
    it('never values a dispersed player below his point estimate', () => {
      const point_estimate = calculate_distributional_baselines({
        players: flat_board,
        league: two_team_league,
        draws: 1,
        dispersion_by_pid: flat_dispersion(flat_board, 0)
      })
      const drawn = calculate_distributional_baselines({
        players: flat_board,
        league: two_team_league,
        draws: 4000,
        dispersion_by_pid: flat_dispersion(flat_board, 45)
      })

      expect(drawn.total_pts_added).to.be.greaterThan(
        point_estimate.total_pts_added
      )
    })

    it('reports a null baseline for a position the league cannot fill', () => {
      const { baselines } = calculate_distributional_baselines({
        players: [make_player({ pid: 'qb1', position: 'QB', total: 400 })],
        league: two_team_league,
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
        draws: 3
      })
      expect(expected_surplus).to.not.have.property('absent')
    })

    // Production supplies no dispersion; the model derives it from the board.
    // The result must therefore differ from the zero-dispersion case rather than
    // silently collapsing to a point estimate, which is the failure mode a
    // dropped or unread dispersion would produce.
    it('derives its own dispersion when none is supplied', () => {
      const derived = calculate_distributional_baselines({
        players: flat_board,
        league: two_team_league,
        draws: 3000
      })
      const point_estimate = calculate_distributional_baselines({
        players: flat_board,
        league: two_team_league,
        draws: 1,
        dispersion_by_pid: flat_dispersion(flat_board, 0)
      })

      expect(derived.total_pts_added).to.be.greaterThan(
        point_estimate.total_pts_added
      )
      for (const position of ['QB', 'RB', 'WR', 'TE']) {
        expect(Number.isFinite(derived.baselines[position])).to.equal(true)
      }
    })
  })

  // The drawn board only ever returns a surplus for a player who was IN the
  // pool. Everyone else -- a kicker, a position the league does not start, a
  // player with no projection for the season -- has to come back out of this
  // function distinguishable from a player worth zero, and the spelling for that
  // is the ABSENT key (operator ruling 2026-09-02, replacing a -999 sentinel).
  //
  // Asserted as a PAIR, because a check on the excluded player alone passes
  // whether the function omits every key or writes every value correctly.
  describe('assign_expected_surplus', function () {
    it('omits the season key for a player who was never in the drawn pool', () => {
      const players = [
        { pid: 'in_pool', pts_added: {} },
        { pid: 'excluded', pts_added: {} }
      ]

      assign_expected_surplus({
        players,
        expected_surplus: { in_pool: 14.5 }
      })

      expect(players[0].pts_added[season_aggregate_key]).to.equal(14.5)
      expect(players[1].pts_added).to.not.have.property(season_aggregate_key)
    })

    // A surplus of 0 is a real measurement: E[max(X - baseline, 0)] can round to
    // nothing for a player who was drawn every pass. It must not be confused with
    // the exclusion above, which is the whole point of not spelling either as 0.
    it('keeps a season key holding a real zero', () => {
      const players = [{ pid: 'replacement_level', pts_added: {} }]

      assign_expected_surplus({
        players,
        expected_surplus: { replacement_level: 0 }
      })

      expect(players[0].pts_added).to.have.property(season_aggregate_key)
      expect(players[0].pts_added[season_aggregate_key]).to.equal(0)
    })

    // The client recomputes onto the same objects the payload populated, so an
    // excluded player carrying a server value must come out of a recompute with
    // the key GONE rather than with the stale number still on it.
    it('clears a stale season key rather than leaving it in place', () => {
      const players = [{ pid: 'excluded', pts_added: { season: 77 } }]

      assign_expected_surplus({ players, expected_surplus: {} })

      expect(players[0].pts_added).to.not.have.property(season_aggregate_key)
    })
  })
})
