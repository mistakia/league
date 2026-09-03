/* global describe it */

import * as chai from 'chai'

import calculateStatsFromPlays from '#libs-shared/calculate-stats-from-plays.mjs'

const expect = chai.expect

// is_touchdown is true for ANY touchdown on the play, INCLUDING one the defense
// scored, and the play shape survives the turnover: a rush fumbled and returned
// is still play_type RUSH with ball_carrier_pid naming the player who lost the
// ball. Crediting is_touchdown to a role pid therefore credited the offense with
// the defense's return.
//
// Each case below is a discriminating PAIR: identical play, identical role pids,
// differing only in the role-named flag. Without the fix both halves count and
// the pair cannot tell the fix from its absence.
describe('calculate_stats_from_plays touchdown attribution', function () {
  const rush_play = ({ is_rushing_touchdown }) => ({
    play_type: 'RUSH',
    offense_nfl_team: 'ZZ',
    ball_carrier_pid: 'TEST-CARR-000001',
    yards_gained: 12,
    rush_yards: 12,
    is_touchdown: true,
    is_rushing_touchdown
  })

  const pass_play = ({ is_passing_touchdown }) => ({
    play_type: 'PASS',
    offense_nfl_team: 'ZZ',
    passer_pid: 'TEST-PASS-000001',
    target_pid: 'TEST-RECV-000001',
    is_completion: true,
    pass_yards: 12,
    receiving_yards: 12,
    depth_of_target: 6,
    is_touchdown: true,
    is_passing_touchdown
  })

  it('credits the rusher when the RUSHER scored', () => {
    const players = calculateStatsFromPlays([
      rush_play({ is_rushing_touchdown: true })
    ])
    expect(players['TEST-CARR-000001'].rushing_touchdowns).to.equal(1)
  })

  it('does NOT credit the rusher when the DEFENSE scored', () => {
    // The fumble the defense took back. Same play_type, same ball_carrier_pid.
    const players = calculateStatsFromPlays([
      rush_play({ is_rushing_touchdown: false })
    ])
    expect(players['TEST-CARR-000001'].rushing_touchdowns).to.equal(0)
  })

  it('credits the passer and receiver when the OFFENSE scored', () => {
    const players = calculateStatsFromPlays([
      pass_play({ is_passing_touchdown: true })
    ])
    expect(players['TEST-PASS-000001'].passing_touchdowns).to.equal(1)
    expect(players['TEST-RECV-000001'].receiving_touchdowns).to.equal(1)
  })

  it('does NOT credit the passer or receiver when the DEFENSE scored', () => {
    // A completion the receiver fumbled back to a defender who scored. The
    // completion itself still counts -- only the touchdown does not.
    const players = calculateStatsFromPlays([
      pass_play({ is_passing_touchdown: false })
    ])
    expect(players['TEST-PASS-000001'].passing_touchdowns).to.equal(0)
    expect(players['TEST-RECV-000001'].receiving_touchdowns).to.equal(0)
    expect(players['TEST-PASS-000001'].passing_completions).to.equal(1)
  })
})
