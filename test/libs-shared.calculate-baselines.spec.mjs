/* global describe it */
import * as chai from 'chai'

import calculateBaselines from '#libs-shared/calculate-baselines.mjs'
import {
  calculate_season_projection_values,
  calculate_weekly_projection_values
} from '#libs-shared/calculate-projection-values.mjs'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'

const expect = chai.expect

// A two-team league with one QB, one RB, one WR, one TE and one superflex per
// team. The superflex is what makes the cross-position baseline reachable: it
// sits in QB's eligible-slot list and accepts RB, WR and TE as well.
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
  starter_slots_defense_special_teams: 0,
  bench_slot_count: 2,
  practice_squad_slot_count: 0,
  ir: 0
}

const make_player = ({ pid, position, total, week = 1 }) => ({
  pid,
  primary_position: position,
  points: { [week]: { total } }
})

// Ten starting slots against twelve players. The fill seats both quarterbacks
// in the dedicated QB slots and puts RB3 (90) and WR3 (70) in the two superflex
// slots -- slots that QB, RB, WR and TE are all eligible for, which is what
// makes those two the cross-position baseline candidates for every position.
const cross_position_board = () => [
  make_player({ pid: 'QB1', position: 'QB', total: 300 }),
  make_player({ pid: 'QB2', position: 'QB', total: 240 }),
  make_player({ pid: 'RB1', position: 'RB', total: 200 }),
  make_player({ pid: 'RB2', position: 'RB', total: 190 }),
  make_player({ pid: 'RB3', position: 'RB', total: 90 }),
  make_player({ pid: 'WR1', position: 'WR', total: 180 }),
  make_player({ pid: 'WR2', position: 'WR', total: 170 }),
  make_player({ pid: 'WR3', position: 'WR', total: 70 }),
  make_player({ pid: 'WR4', position: 'WR', total: 60 }),
  make_player({ pid: 'TE1', position: 'TE', total: 150 }),
  make_player({ pid: 'TE2', position: 'TE', total: 140 }),
  make_player({ pid: 'TE3', position: 'TE', total: 50 })
]

describe('LIBS-SHARED calculate-baselines', function () {
  it('sets a position baseline from the worst starter AT that position', () => {
    const baselines = calculateBaselines({
      players: cross_position_board(),
      league: two_team_league,
      week: 1
    })

    // RB3 at 90 is the worst superflex occupant, and the superflex is in QB's
    // eligible-slot list. Reading the worst occupant of any QB-eligible slot
    // put the QB baseline on a running back at 90 rather than on QB2 at 240.
    expect(baselines.QB.starter.primary_position).to.equal('QB')
    expect(baselines.QB.starter.pid).to.equal('QB2')
    expect(baselines.QB.starter.points[1].total).to.equal(240)

    // Same slot, same defect, at TE -- which seats nobody in the superflex at
    // all, so the old form handed it a wide receiver's 70 in place of TE2's 140.
    expect(baselines.TE.starter.primary_position).to.equal('TE')
    expect(baselines.TE.starter.pid).to.equal('TE2')
    expect(baselines.TE.starter.points[1].total).to.equal(140)
  })

  it('reads each position independently of the flex occupants', () => {
    const baselines = calculateBaselines({
      players: cross_position_board(),
      league: two_team_league,
      week: 1
    })

    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      expect(baselines[position].starter.primary_position).to.equal(position)
    }
  })

  // The free-agent fill used to scan roster by roster and take the first open
  // eligible slot on each, so QB2 claimed team 1's SUPERFLEX while team 2's
  // dedicated QB slot sat empty -- and the players who could only fill a flex
  // then had nowhere to go. Three of the twelve went unseated and a starting
  // slot stayed open on a board with a surplus at every position.
  it('fills every dedicated slot before any flex', () => {
    const baselines = calculateBaselines({
      players: cross_position_board(),
      league: two_team_league,
      week: 1
    })

    // Both quarterbacks start, so QB replacement is the second one rather than
    // whoever happened to be left over.
    expect(baselines.QB.starter.pid).to.equal('QB2')
    expect(baselines.QB.available).to.equal(undefined)

    // And the two superflex slots are taken by the best players who could not
    // claim a dedicated slot.
    expect(baselines.RB.starter.pid).to.equal('RB3')
    expect(baselines.WR.starter.pid).to.equal('WR3')
  })

  it('names the best unrostered player as the available baseline', () => {
    const baselines = calculateBaselines({
      players: cross_position_board(),
      league: two_team_league,
      week: 1
    })

    // Nobody is rostered here, so the fill seats the ten starting slots and
    // `available` is the best of each position left over. QB and RB have none
    // left, which is a legitimate answer and not a zero.
    expect(baselines.WR.available.pid).to.equal('WR4')
    expect(baselines.TE.available.pid).to.equal('TE3')
    expect(baselines.RB.available).to.equal(undefined)
  })
})

// A rostered player with no projection for the week. process-projections builds
// a league's pool as `projection_pids.concat(rostered_pids)`, so this shape is
// routine rather than exotic -- 24 of league 1's 251 rostered players had no
// week-1 projection on 2026-08-02.
const make_unprojected_player = ({ pid, position }) => ({
  pid,
  primary_position: position,
  points: {}
})

// The pool arrives from a database query in no particular order, and that is
// load-bearing for this defect: a NaN comparator leaves an ALREADY-ordered array
// alone, so an unshuffled fixture reproduces nothing and would be a gate that
// cannot fail. Shuffled with a fixed LCG so the fixture is deterministic.
const shuffled = ({ items, seed }) => {
  let state = seed
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Twelve projected players and sixteen unprojected ones, shuffled at seed 2.
// Against the pre-fix comparator this arrangement corrupts ALL FOUR positional
// baselines and hands TE a player who has no projection at all.
const mixed_board = () =>
  shuffled({
    items: cross_position_board().concat(
      Array.from({ length: 16 }, (_, i) =>
        make_unprojected_player({
          pid: `NOPROJ${i}`,
          position: ['QB', 'RB', 'WR', 'TE'][i % 4]
        })
      )
    ),
    seed: 2
  })

describe('LIBS-SHARED calculate-baselines unprojected players', function () {
  // The comparator was `(b.points[week] || {}).total - (a...)`, which returns
  // NaN whenever either side has no projection for the week. A NaN comparator is
  // not an ordering, so V8 placed elements arbitrarily -- and the damage was not
  // confined to the unprojected players, it scattered the ones that sort fine.
  // In production it seated a 0.71-point bench quarterback ahead of every
  // starter and made him the QB replacement level for weeks 1 through 12.
  it('orders the board correctly when the pool holds unprojected players', () => {
    const baselines = calculateBaselines({
      players: mixed_board(),
      league: two_team_league,
      week: 1
    })

    // Exactly the answers the clean board gives above. They must not stop
    // holding because players without a projection joined the pool.
    expect(baselines.QB.starter.pid).to.equal('QB2')
    expect(baselines.RB.starter.pid).to.equal('RB3')
    expect(baselines.WR.starter.pid).to.equal('WR3')
    expect(baselines.TE.starter.pid).to.equal('TE2')
  })

  it('never names an unprojected player as a baseline', () => {
    const baselines = calculateBaselines({
      players: mixed_board(),
      league: two_team_league,
      week: 1
    })

    // An unprojected player cannot be ranked, so he is neither a replacement
    // level nor the best available -- both are claims about a number he has not
    // got.
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      for (const type of ['starter', 'available']) {
        const baseline = baselines[position][type]
        if (baseline) expect(baseline.pid).to.not.match(/^NOPROJ/)
      }
    }
  })

  it('does not reorder the array it was given', () => {
    const players = mixed_board()
    const order_before = players.map((player) => player.pid)

    calculateBaselines({ players, league: two_team_league, week: 1 })

    // process-projections reuses one array for every week of the run, so
    // sorting in place made each week start from the previous week's ordering.
    expect(players.map((player) => player.pid)).to.deep.equal(order_before)
  })

  // Replacement level is the marginal player a team could FIELD. A zero
  // projection is a bye or an inactive, and a manager holding one picks somebody
  // up rather than starting him -- so he is seatable but not a baseline. Week 9
  // of the live 2026 board is the case: Pittsburgh's defense is on bye at 0.00,
  // and admitting it set DST replacement to zero and handed every defense in the
  // league its full projection as surplus.
  it('does not set a baseline from a zero projection', () => {
    const players = cross_position_board().concat([
      make_player({ pid: 'TE_BYE', position: 'TE', total: 0 }),
      make_player({ pid: 'QB_BYE', position: 'QB', total: 0 })
    ])

    const baselines = calculateBaselines({
      players,
      league: two_team_league,
      week: 1
    })

    expect(baselines.TE.starter.pid).to.equal('TE2')
    expect(baselines.QB.starter.pid).to.equal('QB2')
  })

  it('is stable across repeated calls on the same array', () => {
    const players = mixed_board()

    const first = calculateBaselines({
      players,
      league: two_team_league,
      week: 1
    })
    const second = calculateBaselines({
      players,
      league: two_team_league,
      week: 1
    })

    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      expect(second[position].starter.pid).to.equal(first[position].starter.pid)
    }
  })
})

describe('LIBS-SHARED calculate-projection-values', function () {
  it('carries both baselines on a weekly board', () => {
    const { baselines } = calculate_weekly_projection_values({
      players: cross_position_board(),
      league: two_team_league,
      week: 1
    })

    expect(baselines.QB.starter.pid).to.equal('QB2')
    expect(baselines.QB.starter.points).to.equal(240)
    expect(baselines.WR.available.pid).to.equal('WR4')
    expect(baselines.WR.available.points).to.equal(60)
  })

  it('leaves the available baseline null on the season board', () => {
    const players = cross_position_board().map((player) =>
      make_player({
        pid: player.pid,
        position: player.primary_position,
        total: player.points[1].total,
        // The season board is published under the season KEY. Writing it under a
        // reserved week number is what production did after the period split,
        // and it priced every player at the sentinel.
        week: season_aggregate_key
      })
    )

    const { baselines } = calculate_season_projection_values({
      players,
      league: two_team_league
    })

    // The season baseline is an expectation over drawn seasons, so it holds no
    // pid; `available` is a roster-aware question the season board does not ask
    // and nothing reads on the season period.
    expect(baselines.QB.starter.pid).to.equal(null)
    expect(baselines.QB.starter.points).to.be.a('number')
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      expect(baselines[position].available).to.equal(null)
    }
  })
})
