/* global describe it */
import * as chai from 'chai'

import calculate_player_period_values, {
  season_net_aggregate_key,
  rest_of_season_aggregate_key,
  rest_of_season_net_aggregate_key
} from '#libs-shared/calculate-player-period-values.mjs'
import { default_points_added } from '#constants'

const expect = chai.expect

// A dfs_fixed format skips pricing entirely, which keeps these cases about the
// aggregation and nothing else. calculate-prices.mjs has its own file.
const league_format = { pricing_model: 'dfs_fixed' }

const run = ({ pts_added, current_week = 1 }) => {
  const player = { pid: 'TEST-PLAY-000001', pts_added }
  calculate_player_period_values({
    players: [player],
    league: league_format,
    current_week
  })
  return player.pts_added
}

describe('LIBS-SHARED calculate_player_period_values', function () {
  describe('period sums', function () {
    it('sums the weekly board over each period window', function () {
      const result = run({
        pts_added: { 1: 10, 2: -4, 3: 6 },
        current_week: 2
      })

      expect(result[season_net_aggregate_key]).to.equal(12)
      expect(result[rest_of_season_aggregate_key]).to.equal(6)
      expect(result[rest_of_season_net_aggregate_key]).to.equal(2)
    })

    // The season net is a sum of WEEKLY-grain nets, not a draw at season grain.
    // Nothing in the schema can tell those apart -- both are plausible numbers in
    // a plausible column -- so the discriminator is that moving ONE week has to
    // move the season net. A period-grain draw would not.
    it('moves the season net when a single week moves', function () {
      const before = run({ pts_added: { 1: 10, 2: 5 } })[
        season_net_aggregate_key
      ]
      const after = run({ pts_added: { 1: 10, 2: 9 } })[
        season_net_aggregate_key
      ]

      expect(after - before).to.equal(4)
    })

    it('skips the weekly sentinel rather than summing it', function () {
      const result = run({
        pts_added: { 1: 10, 2: default_points_added, 3: 5 }
      })

      expect(result[season_net_aggregate_key]).to.equal(15)
    })

    it('ignores aggregate keys already on the map', function () {
      const result = run({
        pts_added: { 1: 10, season: 99, [season_net_aggregate_key]: 99 }
      })

      expect(result[season_net_aggregate_key]).to.equal(10)
    })
  })

  // "Never in the drawn pool" is spelled by the ABSENCE of the key -- operator
  // ruling 2026-09-02, replacing a conflated 0. These cases are the pair that
  // makes the distinction observable: a player with no contributing week and a
  // player whose weeks all contribute and sum to nothing look identical in the
  // stored number and must not look identical in the payload.
  describe('never in the drawn pool', function () {
    it('omits every period key when no week contributed', function () {
      const result = run({
        pts_added: { 1: default_points_added, 2: default_points_added }
      })

      expect(result).to.not.have.property(season_net_aggregate_key)
      expect(result).to.not.have.property(rest_of_season_aggregate_key)
      expect(result).to.not.have.property(rest_of_season_net_aggregate_key)
    })

    it('omits rather than assigning null', function () {
      const result = run({ pts_added: { 1: default_points_added } })

      // `undefined` is what an absent key reads as, and asserting only that
      // would pass on an explicit `undefined` assignment too -- which
      // JSON.stringify drops but Object.keys does not, and the payload builder
      // iterates keys.
      expect(Object.keys(result)).to.not.include(rest_of_season_aggregate_key)
    })

    // The control for the case above. A player in the pool every week who never
    // clears replacement is a real zero and keeps his keys.
    it('keeps a period key holding a real zero', function () {
      const result = run({ pts_added: { 1: -5, 2: -3 } })

      expect(result[rest_of_season_aggregate_key]).to.equal(0)
      expect(result[season_net_aggregate_key]).to.equal(-8)
    })

    // Membership is judged per PERIOD. A player projected early and not after is
    // in the season pool and out of the rest-of-season one, and collapsing the
    // two would either lose his season value or invent a rest-of-season zero.
    it('judges each period window separately', function () {
      const result = run({
        pts_added: { 1: 12, 2: default_points_added },
        current_week: 2
      })

      expect(result[season_net_aggregate_key]).to.equal(12)
      expect(result).to.not.have.property(rest_of_season_aggregate_key)
      expect(result).to.not.have.property(rest_of_season_net_aggregate_key)
    })

    // The SPA recomputes onto the same player objects the API payload populated,
    // so a stale server value under a key the recompute has decided is absent
    // would survive as a number nothing produced.
    it('clears a stale key left by a previous pass', function () {
      const player = {
        pid: 'TEST-PLAY-000002',
        pts_added: {
          1: default_points_added,
          [rest_of_season_aggregate_key]: 88
        }
      }

      calculate_player_period_values({
        players: [player],
        league: league_format,
        current_week: 1
      })

      expect(player.pts_added).to.not.have.property(
        rest_of_season_aggregate_key
      )
    })
  })
})
