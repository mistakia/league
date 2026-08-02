/* global describe it */
import * as chai from 'chai'

import calculateBaselines from '#libs-shared/calculate-baselines.mjs'
import calculate_projection_values from '#libs-shared/calculate-projection-values.mjs'
import { season_projection_week } from '#libs-shared/calculate-distributional-baselines.mjs'

const expect = chai.expect

// A two-team league with one QB, one RB, one WR, one TE and one superflex per
// team. The superflex is what makes the cross-position baseline reachable: it
// sits in QB's eligible-slot list and accepts RB, WR and TE as well.
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
  sdst: 0,
  bench: 2,
  ps: 0,
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

describe('LIBS-SHARED calculate-projection-values', function () {
  it('carries both baselines on a weekly board', () => {
    const { baselines } = calculate_projection_values({
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
        week: season_projection_week
      })
    )

    const { baselines } = calculate_projection_values({
      players,
      league: two_team_league,
      week: season_projection_week
    })

    // The season baseline is an expectation over drawn seasons, so it holds no
    // pid; `available` is a roster-aware question the season board does not ask
    // and nothing reads at week 0.
    expect(baselines.QB.starter.pid).to.equal(null)
    expect(baselines.QB.starter.points).to.be.a('number')
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      expect(baselines[position].available).to.equal(null)
    }
  })
})
