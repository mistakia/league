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
// user:task/league/make-kicking-and-dst-scoring-configurable.md, and
// mutation-checked there. calculate-points.mjs was byte-identical between that
// commit and the deployed production commit, so the baseline it pinned was
// production's behavior rather than the working tree's.
//
// The registry rewrite has since landed, and four assertions here now pin the
// NEW behavior. Each is marked INTENTIONAL DIFF and states what changed and
// why; nothing was deleted to make the suite pass. Only one of them moves a
// score, and only for a stat line production does not hold -- see the kicking
// block and test/libs-shared.scoring-format-equivalence.spec.mjs, which checks
// the no-score-moves claim across all 65 production formats.

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
  // The whole result object is persisted, not just `total` --
  // scripts/calculate-points.mjs and app/core/worker/index.js both store it as
  // it comes. So the KEY SET is a contract, and a registry-driven rewrite that
  // skips an entry carrying no config column, or that renames a key, changes
  // the shape of every stored points object without changing a single number.
  describe('result shape', function () {
    // INTENTIONAL DIFF: forty keys became forty-one, and the shape no longer
    // varies with the stat line.
    //
    // `field_goal_yards` is new -- it is now a configurable rate with a score
    // of its own, where before the per-yard value was stored under
    // `field_goals_made`. And the five band keys used to be absent whenever the
    // per-yard arm was taken, so the key set depended on the stats; with the
    // branch gone, every call returns the same keys in the same order.
    it('carries the same forty-one keys regardless of the stat line', () => {
      const expected_keys = [
        'total',
        'passing_attempts',
        'passing_completions',
        'passing_yards',
        'passing_interceptions',
        'passing_touchdowns',
        'rushing_attempts',
        'rushing_yards',
        'rushing_yards_excluding_kneels',
        'rushing_touchdowns',
        'rushing_first_downs',
        'fumbles_lost',
        'targets',
        'receptions',
        'receiving_yards',
        'receiving_first_downs',
        'receiving_touchdowns',
        'two_point_conversions',
        'punt_return_touchdowns',
        'kickoff_return_touchdowns',
        'fumble_return_touchdowns',
        'field_goals_made',
        'field_goal_yards',
        'field_goals_made_0_19_yards',
        'field_goals_made_20_29_yards',
        'field_goals_made_30_39_yards',
        'field_goals_made_40_49_yards',
        'field_goals_made_50_plus_yards',
        'extra_points_made',
        'defensive_sacks',
        'defensive_interceptions',
        'defensive_forced_fumbles',
        'defensive_recovered_fumbles',
        'defensive_three_and_outs',
        'defensive_fourth_down_stops',
        'defensive_points_against',
        'defensive_yards_against',
        'defensive_blocked_kicks',
        'defensive_safeties',
        'defensive_two_point_returns',
        'defensive_touchdowns'
      ]

      expect(
        Object.keys(calculatePoints({ league: ppr_league(), stats: {} }))
      ).to.eql(expected_keys)

      expect(
        Object.keys(
          calculatePoints({
            league: ppr_league(),
            stats: { field_goals_made: 1, field_goals_made_40_49_yards: 1 }
          })
        )
      ).to.eql(expected_keys)
    })

    // Replaces an assertion that the per-yard arm DROPPED the five band keys.
    // There is no longer an arm to drop them, and a stable key set is the
    // point: a consumer reading a band off a kicker's score now gets a number
    // rather than undefined.
    it('keys a kicker with field goal yards identically to an empty stat line', () => {
      const per_yard_keys = Object.keys(
        calculatePoints({
          league: ppr_league(),
          stats: { field_goal_yards: 40 }
        })
      )
      const empty_keys = Object.keys(
        calculatePoints({ league: ppr_league(), stats: {} })
      )

      expect(per_yard_keys).to.eql(empty_keys)
    })

    it('adds anytime_td as a forty-second key only when the stat is present', () => {
      const with_anytime = calculatePoints({
        league: ppr_league(),
        stats: { anytime_td: 1 }
      })

      expect(Object.keys(with_anytime)).to.have.length(42)
      expect(Object.keys(with_anytime)).to.include('anytime_td')
    })
  })

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

    // INTENTIONAL DIFF from the pre-registry implementation, and the only one
    // that moves a number.
    //
    // Before: an `if (stats.field_goal_yards)` branch returned `yards / 10` and
    // stored it under `field_goals_made`, else it scored the five bands at
    // 3/3/3/4/5. The two arms were exclusive, so a format could not do both and
    // the band arm was unreachable in production -- field_goal_yards is
    // populated on every kicker gamelog that carries band counts (2025 REG: 453
    // gamelogs with both, ZERO with bands and no yards).
    //
    // After: one additive expression, bands plus the per-yard term, with the
    // rate in `field_goal_yards` and each band in its own column. The backfill
    // sets the rate to 0.1 and every band to 0, which reproduces the per-yard
    // arm exactly. A banded league now sets the bands and zeroes the rate --
    // the inverse -- which was not expressible before.
    //
    // The per-yard score also moves key, from `field_goals_made` to
    // `field_goal_yards`, which is where it always belonged: it is a rate
    // applied to yards, not a value per made kick.
    it('scores field goals per yard at the configured rate', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: {
          field_goal_yards: 187,
          field_goals_made: 5,
          field_goals_made_30_39_yards: 2,
          field_goals_made_50_plus_yards: 1
        }
      })

      close_to(result.field_goal_yards, 18.7)
      close_to(result.total, 18.7)
    })

    // The band keys are now always present, because there is no longer a branch
    // to short-circuit them. They score zero under the backfilled defaults.
    it('writes every band key, scoring zero under the backfilled defaults', () => {
      const result = calculatePoints({
        league: ppr_league(),
        stats: { field_goal_yards: 187, field_goals_made_30_39_yards: 2 }
      })

      close_to(result.field_goals_made_0_19_yards, 0)
      close_to(result.field_goals_made_20_29_yards, 0)
      close_to(result.field_goals_made_30_39_yards, 0)
      close_to(result.field_goals_made_40_49_yards, 0)
      close_to(result.field_goals_made_50_plus_yards, 0)
      close_to(result.total, 18.7)
    })

    // A format that wants the legacy 3/3/3/4/5 bands can now express them, and
    // gets them ADDITIVELY with the rate rather than instead of it. Zeroing the
    // rate reproduces the old band arm exactly.
    it('scores configured bands additively with the per-yard rate', () => {
      const banded_league = ppr_league({
        field_goal_yards: 0,
        field_goals_made_0_19_yards: 3,
        field_goals_made_20_29_yards: 3,
        field_goals_made_30_39_yards: 3,
        field_goals_made_40_49_yards: 4,
        field_goals_made_50_plus_yards: 5
      })

      const result = calculatePoints({
        league: banded_league,
        stats: {
          field_goal_yards: 187,
          field_goals_made: 4,
          field_goals_made_0_19_yards: 1,
          field_goals_made_20_29_yards: 1,
          field_goals_made_30_39_yards: 1,
          field_goals_made_40_49_yards: 0,
          field_goals_made_50_plus_yards: 1
        }
      })

      close_to(result.field_goals_made_0_19_yards, 3)
      close_to(result.field_goals_made_20_29_yards, 3)
      close_to(result.field_goals_made_30_39_yards, 3)
      close_to(result.field_goals_made_40_49_yards, 0)
      close_to(result.field_goals_made_50_plus_yards, 5)
      close_to(result.field_goal_yards, 0)
      close_to(result.total, 14)
    })

    // Covers the registry-default fallback in league_value, which the
    // equivalence gate structurally cannot reach: that fixture's configs are
    // real post-migration rows, so every column is present and the fallback
    // never fires. It fires for every caller that assembles a config by hand --
    // the named format definitions declare only the base columns -- and before
    // kicking was configurable such a caller scored it correctly by
    // construction. Without the fallback it would silently score zero.
    it('falls back to the registry default when the config omits a column', () => {
      const base_only = ppr_league()
      expect(
        base_only.field_goal_yards,
        'fixture must omit the column'
      ).to.equal(undefined)

      const explicit = ppr_league({
        field_goal_yards: 0.1,
        extra_points_made: 1,
        defensive_sacks: 1,
        defensive_touchdowns: 6,
        defensive_points_against: -0.4,
        defensive_points_against_threshold: 20
      })

      const stats = {
        field_goal_yards: 187,
        extra_points_made: 3,
        defensive_sacks: 4,
        defensive_touchdowns: 1,
        defensive_points_against: 31
      }

      const fallback_result = calculatePoints({ league: base_only, stats })
      const explicit_result = calculatePoints({ league: explicit, stats })

      close_to(fallback_result.total, explicit_result.total)
      close_to(fallback_result.field_goal_yards, 18.7)
      close_to(fallback_result.defensive_points_against, -4.4)
    })

    // A configured zero must survive rather than inherit the default, which is
    // why league_value tests for undefined rather than falsiness.
    it('keeps a configured zero instead of inheriting the default', () => {
      const result = calculatePoints({
        league: ppr_league({ field_goal_yards: 0 }),
        stats: { field_goal_yards: 187 }
      })

      close_to(result.field_goal_yards, 0)
      close_to(result.total, 0)
    })

    // Unchanged intent, cleaner mechanism. calculate-stats-from-play-stats.mjs
    // increments both field_goals_made and one distance band per made kick, so
    // the total and the partition of that total are both present and scoring
    // both would double-count every field goal. Before, the omission was an
    // expression the code computed and then declined to add; now it is a
    // registry entry carrying no config column, so there is no value to add.
    // The key is still emitted, because the result object's key set is a
    // persisted contract.
    it('never scores field_goals_made, the total the bands partition', () => {
      const result = calculatePoints({
        league: ppr_league({
          field_goal_yards: 0,
          field_goals_made_40_49_yards: 4
        }),
        stats: { field_goals_made: 4, field_goals_made_40_49_yards: 2 }
      })

      close_to(result.field_goals_made, 0)
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
