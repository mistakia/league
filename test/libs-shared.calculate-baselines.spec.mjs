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

// A board whose two superflex slots end up holding QB2 (240) and RB3 (90). RB3
// is the worst occupant of a slot that QB, RB, WR and TE are all eligible for,
// which is what makes him the cross-position baseline candidate for every one
// of those positions.
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

    // Same slot, same defect, at WR -- where it cost 80 points of replacement
    // level rather than 150.
    expect(baselines.WR.starter.pid).to.equal('WR2')
    expect(baselines.WR.starter.points[1].total).to.equal(170)
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

  it('names the best unrostered player as the available baseline', () => {
    const baselines = calculateBaselines({
      players: cross_position_board(),
      league: two_team_league,
      week: 1
    })

    // Nobody is rostered here, so the fill seats what it can and `available` is
    // the best of each position left over. RB has none left, which is a
    // legitimate answer and not a zero.
    expect(baselines.WR.available.pid).to.equal('WR3')
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
    expect(baselines.WR.available.pid).to.equal('WR3')
    expect(baselines.WR.available.points).to.equal(70)
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
