/* global describe it */

// Characterization spec for libs-shared/calculate-points.mjs.
//
// This function scores every league and had no dedicated coverage. It is
// written to pin CURRENT behavior, including behavior that reads like a defect,
// so that the move of kicking and DST scoring into league_scoring_formats
// cannot change a score silently. Where a case is a quirk rather than a design
// choice, the comment says so and the assertion still pins it -- a
// characterization spec that only records the intended half is not a baseline.
//
// Proven green at 38dfc4c32 in a clean worktree before any other change in
// user:task/league/make-kicking-and-dst-scoring-configurable.md. calculate-points.mjs
// is byte-identical between that commit and production 6730dc39b.

import * as chai from 'chai'

import { calculatePoints } from '#libs-shared'
import { scoring_formats } from '#libs-shared/league-format-definitions.mjs'

const expect = chai.expect

// Tolerance exists only to absorb IEEE-754 accumulation (0.04 * 300 is
// 12.000000000000002). Any real scoring change is at least a hundredth of a
// point, so this is four orders of magnitude short of hiding one.
const EPSILON = 1e-9

const close_to = (actual, expected) =>
  expect(actual).to.be.closeTo(expected, EPSILON)

// A real production config, not an invented one, so the base-scoring cases are
// anchored to a format leagues actually use.
const ppr_league = (overrides = {}) => ({
  ...scoring_formats.ppr.config,
  ...overrides
})

describe('LIBS-SHARED calculatePoints', function () {
  describe('base scoring', function () {
    it('scores a full stat line against the ppr format', () => {
      const result = calculatePoints({
        position: 'QB',
        league: ppr_league(),
        stats: {
          passing_yards: 300,
          passing_touchdowns: 2,
          passing_interceptions: 1,
          rushing_attempts: 3,
          rushing_yards: 20,
          rushing_touchdowns: 1,
          targets: 8,
          receptions: 5,
          receiving_yards: 60,
          fumbles_lost: 1,
          two_point_conversions: 1
        }
      })

      close_to(result.passing_yards, 12)
      close_to(result.passing_touchdowns, 8)
      close_to(result.passing_interceptions, -2)
      close_to(result.rushing_attempts, 0)
      close_to(result.rushing_yards, 2)
      close_to(result.rushing_touchdowns, 6)
      close_to(result.targets, 0)
      close_to(result.receptions, 5)
      close_to(result.receiving_yards, 6)
      close_to(result.fumbles_lost, -2)
      close_to(result.two_point_conversions, 2)
      close_to(result.total, 37)
    })

    it('treats a missing stat and a missing league factor as zero', () => {
      const result = calculatePoints({
        league: { passing_yards: 0.04 },
        stats: { passing_yards: 100, passing_touchdowns: 3 }
      })

      close_to(result.passing_touchdowns, 0)
      close_to(result.total, 4)
    })

    it('scores return touchdowns from the base list', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: {
          punt_return_touchdowns: 1,
          kickoff_return_touchdowns: 1,
          fumble_return_touchdowns: 1
        }
      })

      close_to(result.punt_return_touchdowns, 6)
      close_to(result.kickoff_return_touchdowns, 6)
      close_to(result.fumble_return_touchdowns, 6)
      close_to(result.total, 18)
    })
  })

  describe('position-aware receptions', function () {
    const positional_league = ppr_league({
      receptions: 1,
      running_back_reception: 2,
      wide_receiver_reception: 1.5,
      tight_end_reception: 0.5
    })

    const score_receptions = (position) =>
      calculatePoints({
        position,
        league: positional_league,
        stats: { receptions: 4 }
      }).receptions

    it('uses the per-position value for RB, WR and TE', () => {
      close_to(score_receptions('RB'), 8)
      close_to(score_receptions('WR'), 6)
      close_to(score_receptions('TE'), 2)
    })

    it('falls back to the base value for positions without an override', () => {
      close_to(score_receptions('QB'), 4)
      close_to(score_receptions('K'), 4)
      close_to(score_receptions('DST'), 4)
      close_to(score_receptions(''), 4)
    })

    it('matches the position case-insensitively', () => {
      close_to(score_receptions('rb'), 8)
    })

    // Quirk: the lookup is `(column && league[column]) || scoring[stat]`, so a
    // position override of exactly 0 is falsy and falls back to the base value.
    // A league that wants tight ends to score nothing per reception cannot
    // express it through the override alone.
    it('falls back to the base value when a position override is zero', () => {
      const result = calculatePoints({
        position: 'TE',
        league: ppr_league({ receptions: 1, tight_end_reception: 0 }),
        stats: { receptions: 4 }
      })

      close_to(result.receptions, 4)
    })
  })

  describe('quarterback kneel exclusion', function () {
    const kneel_league = ppr_league({ exclude_quarterback_kneels: true })

    const score_rushing_yards = ({ league, stats }) =>
      calculatePoints({ league, stats }).rushing_yards

    it('uses rushing_yards_excluding_kneels when the flag is set and the value is populated', () => {
      close_to(
        score_rushing_yards({
          league: kneel_league,
          stats: { rushing_yards: 30, rushing_yards_excluding_kneels: 25 }
        }),
        2.5
      )
    })

    it('uses rushing_yards when the flag is not set', () => {
      close_to(
        score_rushing_yards({
          league: ppr_league({ exclude_quarterback_kneels: false }),
          stats: { rushing_yards: 30, rushing_yards_excluding_kneels: 25 }
        }),
        3
      )
    })

    it('uses rushing_yards when the excluding value is absent or null', () => {
      close_to(
        score_rushing_yards({
          league: kneel_league,
          stats: { rushing_yards: 30 }
        }),
        3
      )
      close_to(
        score_rushing_yards({
          league: kneel_league,
          stats: { rushing_yards: 30, rushing_yards_excluding_kneels: null }
        }),
        3
      )
    })

    // The zero guard distinguishes "not yet calculated" from "genuinely zero":
    // a zero excluding-value is only trusted when rushing_yards is also zero.
    it('ignores an excluding value of zero unless rushing_yards is also zero', () => {
      close_to(
        score_rushing_yards({
          league: kneel_league,
          stats: { rushing_yards: 30, rushing_yards_excluding_kneels: 0 }
        }),
        3
      )
      close_to(
        score_rushing_yards({
          league: kneel_league,
          stats: { rushing_yards: 0, rushing_yards_excluding_kneels: 0 }
        }),
        0
      )
    })

    // rushing_yards_excluding_kneels is itself a member of base_fantasy_stats,
    // so it is scored a second time on its own key. No format carries a factor
    // for it, so it contributes zero and the key on the result is overwritten
    // with that zero after rushing_yards has already consumed it.
    it('scores rushing_yards_excluding_kneels as its own zero-factor stat', () => {
      const result = calculatePoints({
        league: kneel_league,
        stats: { rushing_yards: 30, rushing_yards_excluding_kneels: 25 }
      })

      close_to(result.rushing_yards, 2.5)
      close_to(result.rushing_yards_excluding_kneels, 0)
      close_to(result.total, 2.5)
    })
  })

  describe('kicking', function () {
    it('scores extra points at one point each, always', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: { extra_points_made: 3 }
      })

      close_to(result.extra_points_made, 3)
      close_to(result.total, 3)
    })

    // The per-yard arm is the one production takes: field_goal_yards is
    // populated on every kicker gamelog that has band counts, so the bands
    // below have never applied. Field goals score 0.1 per yard.
    it('scores field goals per yard when field_goal_yards is populated', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: {
          field_goal_yards: 187,
          field_goals_made: 5,
          field_goals_made_30_39_yards: 2,
          field_goals_made_50_plus_yards: 1
        }
      })

      close_to(result.field_goals_made, 18.7)
      close_to(result.total, 18.7)
    })

    // The per-yard arm short-circuits: the band keys are never written to the
    // result at all, so a consumer reading them off a kicker's score gets
    // undefined rather than zero.
    it('leaves the band keys absent from the result on the per-yard arm', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: { field_goal_yards: 187, field_goals_made_30_39_yards: 2 }
      })

      expect(result.field_goals_made_0_19_yards).to.equal(undefined)
      expect(result.field_goals_made_20_29_yards).to.equal(undefined)
      expect(result.field_goals_made_30_39_yards).to.equal(undefined)
      expect(result.field_goals_made_40_49_yards).to.equal(undefined)
      expect(result.field_goals_made_50_plus_yards).to.equal(undefined)
    })

    it('takes the band arm when field_goal_yards is zero or absent', () => {
      const banded_stats = {
        field_goals_made: 4,
        field_goals_made_0_19_yards: 1,
        field_goals_made_20_29_yards: 1,
        field_goals_made_30_39_yards: 1,
        field_goals_made_40_49_yards: 0,
        field_goals_made_50_plus_yards: 1
      }

      for (const stats of [
        banded_stats,
        { ...banded_stats, field_goal_yards: 0 }
      ]) {
        const result = calculatePoints({ league: ppr_league(), stats })

        close_to(result.field_goals_made_0_19_yards, 3)
        close_to(result.field_goals_made_20_29_yards, 3)
        close_to(result.field_goals_made_30_39_yards, 3)
        close_to(result.field_goals_made_40_49_yards, 0)
        close_to(result.field_goals_made_50_plus_yards, 5)
        close_to(result.total, 14)
      }
    })

    // Intended, not a defect: calculate-stats-from-play-stats.mjs increments
    // both field_goals_made and one distance band per made kick, so the total
    // and the partition of that total are both present. field_goals_made is
    // computed for display and deliberately left out of result.total; adding it
    // would double-count every field goal.
    it('computes field_goals_made on the band arm without adding it to the total', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: { field_goals_made: 4, field_goals_made_40_49_yards: 2 }
      })

      close_to(result.field_goals_made, 12)
      close_to(result.total, 8)
    })
  })

  describe('DST', function () {
    it('scores the full defensive stat line at the hardcoded values', () => {
      const result = calculatePoints({
        position: 'DST',
        league: ppr_league(),
        stats: {
          defensive_sacks: 3,
          defensive_interceptions: 2,
          defensive_forced_fumbles: 1,
          defensive_recovered_fumbles: 1,
          defensive_three_and_outs: 4,
          defensive_fourth_down_stops: 1,
          defensive_points_against: 31,
          defensive_yards_against: 350,
          defensive_blocked_kicks: 1,
          defensive_safeties: 1,
          defensive_two_point_returns: 1,
          defensive_touchdowns: 1
        }
      })

      close_to(result.defensive_sacks, 3)
      close_to(result.defensive_interceptions, 4)
      close_to(result.defensive_forced_fumbles, 1)
      close_to(result.defensive_recovered_fumbles, 1)
      close_to(result.defensive_three_and_outs, 4)
      close_to(result.defensive_fourth_down_stops, 1)
      close_to(result.defensive_points_against, -4.4)
      close_to(result.defensive_yards_against, -1)
      close_to(result.defensive_blocked_kicks, 3)
      close_to(result.defensive_safeties, 2)
      close_to(result.defensive_two_point_returns, 2)
      close_to(result.defensive_touchdowns, 6)
      close_to(result.total, 21.6)
    })

    it('clamps points against at the 20-point threshold', () => {
      const score_points_against = (defensive_points_against) =>
        calculatePoints({
          league: ppr_league(),
          stats: { defensive_points_against }
        }).defensive_points_against

      close_to(score_points_against(0), 0)
      close_to(score_points_against(10), 0)
      close_to(score_points_against(20), 0)
      close_to(score_points_against(21), -0.4)
      close_to(score_points_against(45), -10)
      close_to(score_points_against(undefined), 0)
    })

    it('clamps yards against at the 300-yard threshold', () => {
      const score_yards_against = (defensive_yards_against) =>
        calculatePoints({
          league: ppr_league(),
          stats: { defensive_yards_against }
        }).defensive_yards_against

      close_to(score_yards_against(0), 0)
      close_to(score_yards_against(299), 0)
      close_to(score_yards_against(300), 0)
      close_to(score_yards_against(400), -2)
      close_to(score_yards_against(undefined), 0)
    })

    it('writes every DST key as zero on an empty stat line', () => {
      const result = calculatePoints({ league: ppr_league(), stats: {} })

      close_to(result.defensive_sacks, 0)
      close_to(result.defensive_touchdowns, 0)
      close_to(result.defensive_points_against, 0)
      close_to(result.defensive_yards_against, 0)
      close_to(result.total, 0)
    })
  })

  describe('anytime_td', function () {
    it('scores anytime_td at the rushing touchdown value', () => {
      const result = calculatePoints({
        league: ppr_league({ rushing_touchdowns: 4 }),
        stats: { anytime_td: 1.5 }
      })

      close_to(result.anytime_td, 6)
      close_to(result.total, 6)
    })

    // Quirk: the fallback is `league.rushing_touchdowns || 6`, so a format that
    // scores rushing touchdowns at zero scores anytime_td at six.
    it('falls back to six when the rushing touchdown value is absent or zero', () => {
      close_to(
        calculatePoints({ league: {}, stats: { anytime_td: 2 } }).anytime_td,
        12
      )
      close_to(
        calculatePoints({
          league: ppr_league({ rushing_touchdowns: 0 }),
          stats: { anytime_td: 2 }
        }).anytime_td,
        12
      )
    })

    it('omits anytime_td entirely when it is absent or null', () => {
      expect(
        calculatePoints({ league: ppr_league(), stats: {} }).anytime_td
      ).to.equal(undefined)
      expect(
        calculatePoints({ league: ppr_league(), stats: { anytime_td: null } })
          .anytime_td
      ).to.equal(undefined)
    })

    it('scores an anytime_td of zero rather than skipping it', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: { anytime_td: 0 }
      })

      close_to(result.anytime_td, 0)
    })
  })

  describe('projected stats', function () {
    // projected_base_stats is a narrower list: first downs and
    // rushing_yards_excluding_kneels have no projection columns, so they are
    // neither scored nor written to the result.
    it('scores only the projected stat list when use_projected_stats is set', () => {
      const league = ppr_league({
        rushing_first_downs: 1,
        receiving_first_downs: 1
      })
      const stats = {
        rushing_yards: 10,
        rushing_first_downs: 5,
        receiving_first_downs: 5
      }

      const projected = calculatePoints({
        league,
        stats,
        use_projected_stats: true
      })

      expect(projected.rushing_first_downs).to.equal(undefined)
      expect(projected.receiving_first_downs).to.equal(undefined)
      close_to(projected.total, 1)

      const actual = calculatePoints({ league, stats })

      close_to(actual.rushing_first_downs, 5)
      close_to(actual.receiving_first_downs, 5)
      close_to(actual.total, 11)
    })

    it('still applies kicking and DST scoring on the projected path', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: { extra_points_made: 2, defensive_sacks: 3 },
        use_projected_stats: true
      })

      close_to(result.extra_points_made, 2)
      close_to(result.defensive_sacks, 3)
      close_to(result.total, 5)
    })
  })
})
