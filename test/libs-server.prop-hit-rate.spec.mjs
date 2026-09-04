/* global describe it */
import * as chai from 'chai'

import {
  is_player_gamelog_market,
  calculate_line_cushion,
  grade_player_gamelog_selection,
  calculate_player_gamelog_hit_rate
} from '#libs-server/prop-hit-rate.mjs'
import { get_selection_result } from '#libs-server/selection-result.mjs'
import { market_type_mappings } from '#libs-server/prop-market-settlement/market-type-mappings.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Characterization of the grading move, run as a PAIR against the grader it
// replaces. The point is not that the new derivation returns something -- it is
// that it agrees with the old one everywhere the old one had a rule, and returns
// a real result everywhere it did not.
//
// A run reporting agreement everywhere would mean the harness is not reaching
// one of the two graders, so the disagreement set is asserted to be non-empty and
// its membership pinned by name.

const player_gamelog_market_types = Object.keys(market_type_mappings).filter(
  (market_type) =>
    market_type_mappings[market_type].handler === 'PLAYER_GAMELOG'
)

// Every metric column any PLAYER_GAMELOG mapping names, given a value that makes
// the OVER side of a 0.5 line a clear win. Built from the mappings rather than
// hand-listed, so a new market type cannot quietly go ungraded here.
const build_gamelog = (value = 5) => {
  const gamelog = { esbid: 2025090700, pid: 'TEST-PLAY-000001' }
  for (const market_type of player_gamelog_market_types) {
    for (const column of market_type_mappings[market_type].metric_columns ||
      []) {
      gamelog[column] = value
    }
  }
  return gamelog
}

describe('LIBS-SERVER prop_hit_rate', function () {
  describe('coverage against the grader it replaces', function () {
    // The 10 types selection-result.mjs has no case for. It returns null for
    // each, and `is_hit` collapses null to false -- so a market that has never
    // been graded reads as one that has never hit. Enumerated from the mappings
    // and the module source in the plan; pinned here by name so a change to
    // either side has to come past this list.
    const types_with_no_case = [
      'GAME_DEFENSE_SACKS',
      'GAME_FIELD_GOALS_MADE',
      'GAME_TWO_PLUS_TOUCHDOWNS',
      'GAME_ALT_PASSING_INTERCEPTIONS',
      'GAME_ALT_PASSING_ATTEMPTS',
      'GAME_ALT_RUSHING_TOUCHDOWNS',
      'GAME_ALT_RECEIVING_TOUCHDOWNS',
      'GAME_ALT_PASSING_RUSHING_YARDS',
      'GAME_ALT_DEFENSE_SACKS',
      'GAME_ALT_FIELD_GOALS_MADE'
    ]

    it('covers every market type settlement grades from a gamelog', function () {
      expect(player_gamelog_market_types.length).to.equal(33)
      for (const market_type of player_gamelog_market_types) {
        expect(is_player_gamelog_market(market_type), market_type).to.equal(
          true
        )
      }
    })

    it('grades the 10 types the old grader returned null for', function () {
      const player_gamelog = build_gamelog()

      for (const market_type of types_with_no_case) {
        // The control: the old grader has no rule and refuses by returning null.
        const old_result = get_selection_result({
          line: 0.5,
          market_type,
          player_gamelog,
          strict: true,
          selection_type: 'OVER'
        })
        expect(old_result, `${market_type} old grader`).to.equal(null)

        const new_result = grade_player_gamelog_selection({
          player_gamelog,
          market_type,
          selection_metric_line: 0.5,
          selection_type: 'OVER'
        })
        expect(new_result, `${market_type} new grader`).to.be.oneOf([
          'WON',
          'LOST',
          'PUSH'
        ])
      }
    })

    it('agrees with the old grader on the plain over/under types', function () {
      const player_gamelog = build_gamelog(120)
      // Types whose grading is a bare metric-versus-line compare in both
      // graders. The three excluded below are excluded for stated reasons, not
      // because they happen to fail.
      const excluded = new Set([
        // Settlement routes these through special_logic that ignores the line,
        // and the old grader compared a partial column sum against it. The
        // disagreement is the fix, and is asserted separately.
        'ANYTIME_TOUCHDOWN',
        'GAME_TWO_PLUS_TOUCHDOWNS',
        ...types_with_no_case
      ])

      let compared = 0
      for (const market_type of player_gamelog_market_types) {
        if (excluded.has(market_type)) continue
        for (const selection_type of ['OVER', 'UNDER']) {
          const old_result = get_selection_result({
            line: 100.5,
            market_type,
            player_gamelog,
            strict: true,
            selection_type
          })
          if (old_result === null) continue

          const new_result = grade_player_gamelog_selection({
            player_gamelog,
            market_type,
            selection_metric_line: 100.5,
            selection_type
          })
          expect(new_result, `${market_type} ${selection_type}`).to.equal(
            old_result
          )
          compared += 1
        }
      }

      // Guards the loop itself: a `continue` that swallowed every case would
      // otherwise pass this test having compared nothing.
      expect(compared).to.be.greaterThan(20)
    })

    it('counts a return touchdown that the old grader dropped', function () {
      // ANYTIME_TOUCHDOWN names five touchdown columns in its mapping. The old
      // grader summed two of them, so a player whose only score was a punt,
      // kickoff or fumble return graded as not having scored.
      const player_gamelog = {
        esbid: 2025090700,
        pid: 'TEST-PLAY-000001',
        rushing_touchdowns: 0,
        receiving_touchdowns: 0,
        punt_return_touchdowns: 1,
        kickoff_return_touchdowns: 0,
        fumble_return_touchdowns: 0
      }

      expect(
        get_selection_result({
          line: 0.5,
          market_type: 'ANYTIME_TOUCHDOWN',
          player_gamelog,
          strict: true,
          selection_type: 'YES'
        })
      ).to.equal('LOST')

      expect(
        grade_player_gamelog_selection({
          player_gamelog,
          market_type: 'ANYTIME_TOUCHDOWN',
          selection_metric_line: 0.5,
          selection_type: 'YES'
        })
      ).to.equal('WON')
    })

    it('refuses a market type it cannot grade from a gamelog', function () {
      // A play-level type. Returning null here is what the old grader did and
      // what put 31,242 zeroes in production, so the refusal has to be loud.
      expect(() =>
        grade_player_gamelog_selection({
          player_gamelog: build_gamelog(),
          market_type: 'GAME_LONGEST_RECEPTION',
          selection_metric_line: 20.5,
          selection_type: 'OVER'
        })
      ).to.throw(/not graded from a player gamelog/)
    })
  })

  describe('the soft cushion', function () {
    it('reproduces the old cushion arithmetic', function () {
      // Capped: 300 * 0.06 = 18, capped to 16.
      expect(
        calculate_line_cushion({
          market_type: 'GAME_PASSING_YARDS',
          selection_metric_line: 300.5
        })
      ).to.equal(16)
      // Uncapped rate: receptions has no cap, so 15.5 * 0.15 rounds to 2.
      expect(
        calculate_line_cushion({
          market_type: 'GAME_RECEPTIONS',
          selection_metric_line: 15.5
        })
      ).to.equal(2)
      // No cushion declared, so soft equals hard.
      expect(
        calculate_line_cushion({
          market_type: 'GAME_PASSING_TOUCHDOWNS',
          selection_metric_line: 1.5
        })
      ).to.equal(0)
    })

    it('turns a near miss into a soft hit and leaves the hard result alone', function () {
      const player_gamelog = { ...build_gamelog(0), passing_yards: 290 }
      const selection = {
        player_gamelog,
        market_type: 'GAME_PASSING_YARDS',
        selection_metric_line: 300.5,
        selection_type: 'OVER'
      }

      expect(
        grade_player_gamelog_selection({ ...selection, strict: true })
      ).to.equal('LOST')
      expect(
        grade_player_gamelog_selection({ ...selection, strict: false })
      ).to.equal('WON')

      // Both readings must match the grader being replaced, or the move has
      // changed a number rather than relocated it.
      expect(
        get_selection_result({
          line: 300.5,
          market_type: 'GAME_PASSING_YARDS',
          player_gamelog,
          strict: true,
          selection_type: 'OVER'
        })
      ).to.equal('LOST')
      expect(
        get_selection_result({
          line: 300.5,
          market_type: 'GAME_PASSING_YARDS',
          player_gamelog,
          strict: false,
          selection_type: 'OVER'
        })
      ).to.equal('WON')
    })

    it('makes an UNDER harder, because the cushion moves the line one way', function () {
      // Not a symmetric tolerance band. Carried over deliberately: the soft
      // reading of an UNDER is stricter than its hard reading, and anything that
      // "fixes" this changes every stored _soft column.
      const player_gamelog = { ...build_gamelog(0), passing_yards: 290 }
      const selection = {
        player_gamelog,
        market_type: 'GAME_PASSING_YARDS',
        selection_metric_line: 300.5,
        selection_type: 'UNDER'
      }

      expect(
        grade_player_gamelog_selection({ ...selection, strict: true })
      ).to.equal('WON')
      expect(
        grade_player_gamelog_selection({ ...selection, strict: false })
      ).to.equal('LOST')
    })
  })

  describe('the rate over a sample', function () {
    const sample = [
      { esbid: 1, pid: 'P', passing_yards: 350 },
      { esbid: 2, pid: 'P', passing_yards: 200 },
      { esbid: 3, pid: 'P', passing_yards: 300.5 },
      { esbid: 4, pid: 'P', passing_yards: 400 }
    ]

    it('divides hits by every game handed in, keeping PUSH in the denominator', function () {
      const { hits, total, rate, results } = calculate_player_gamelog_hit_rate({
        player_gamelogs: sample,
        market_type: 'GAME_PASSING_YARDS',
        selection_metric_line: 300.5,
        selection_type: 'OVER'
      })

      // Game 3 lands exactly on the line and pushes. It counts against the
      // denominator and not toward hits, matching the stored columns.
      expect(results.map((r) => r.selection_result)).to.deep.equal([
        'WON',
        'LOST',
        'PUSH',
        'WON'
      ])
      expect(hits).to.equal(2)
      expect(total).to.equal(4)
      expect(rate).to.equal(0.5)
    })

    it('carries the game identity so the sample can be shown', function () {
      const { results } = calculate_player_gamelog_hit_rate({
        player_gamelogs: sample,
        market_type: 'GAME_PASSING_YARDS',
        selection_metric_line: 300.5,
        selection_type: 'OVER'
      })
      expect(results.map((r) => r.esbid)).to.deep.equal([1, 2, 3, 4])
    })

    it('reports a rate of 0 for an empty sample rather than dividing by zero', function () {
      const { hits, total, rate } = calculate_player_gamelog_hit_rate({
        player_gamelogs: [],
        market_type: 'GAME_PASSING_YARDS',
        selection_metric_line: 300.5,
        selection_type: 'OVER'
      })
      expect(hits).to.equal(0)
      expect(total).to.equal(0)
      expect(rate).to.equal(0)
    })
  })
})
