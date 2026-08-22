/* global describe it */

import * as chai from 'chai'

import calculateStatsFromPlays from '#libs-shared/calculate-stats-from-plays.mjs'

chai.should()
const expect = chai.expect

// This module runs in the BROWSER via app/core/worker/index.js, which is why
// its play-type predicate has to come from libs-shared rather than libs-server.
describe('calculate_stats_from_plays play-type guard', function () {
  const fumble_play = (play_type) => ({
    play_type,
    is_fumble_lost: true,
    fumble_lost_pid: 'TEST-FUML-000001',
    offense_nfl_team: 'ZZ'
  })

  it('does NOT count a fumble on a penalty-nullified play', () => {
    // The switch below this branch is a de-facto allow-list and never reaches
    // NOPL, but the fumble branch runs before it and was unguarded.
    const players = calculateStatsFromPlays([fumble_play('NOPL')])
    expect(players['TEST-FUML-000001']).to.equal(undefined)
  })

  it('counts a fumble on an ordinary play', () => {
    const players = calculateStatsFromPlays([fumble_play('RUSH')])
    expect(players['TEST-FUML-000001'].fumbles_lost).to.equal(1)
  })

  it('counts a fumble on a two-point conversion', () => {
    // A turnover on a two-point try really happened. The guard is
    // non_nullified, not the stricter stat_countable set.
    const players = calculateStatsFromPlays([fumble_play('CONV')])
    expect(players['TEST-FUML-000001'].fumbles_lost).to.equal(1)
  })

  it('counts one fumble across a mixed set rather than three', () => {
    const players = calculateStatsFromPlays([
      fumble_play('NOPL'),
      fumble_play('RUSH')
    ])
    expect(players['TEST-FUML-000001'].fumbles_lost).to.equal(1)
  })
})
