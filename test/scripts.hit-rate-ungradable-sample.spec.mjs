/* global describe it */
import * as chai from 'chai'

import {
  calculate_hit_rate,
  get_hits
} from '#scripts/calculate-historical-hit-rates.mjs'
import { market_type_mappings } from '#libs-server/prop-market-settlement/market-type-mappings.mjs'
import { get_selection_result } from '#libs-server/selection-result.mjs'

const expect = chai.expect

// The six GAME_ALT_* types carry no selection_metric_line at all, so
// determine_selection_result refuses on every game in every sample. Scoring
// those refusals as misses produced a rate of exactly 0.0000 -- and a recompute
// wrote 22,444 such rows over a column that had been NULL, telling every reader
// the prop had never once hit on markets nobody had ever graded. That is the
// defect the corrected grader exists to remove, reappearing one layer down.
//
// The rule: a sample nothing could be graded in has NO rate. A sample where only
// SOME games refused still scores them as misses, per the ruling that a PUSH and
// an ungradable game both count against the denominator -- that ruling governs
// individual games inside a gradable sample, not a selection that cannot be
// graded at all.

describe('hit rate over an ungradable sample', function () {
  it('has no rate when every game refused', function () {
    expect(calculate_hit_rate({ hits: 0, total: 17, ungradable: 17 })).to.equal(
      null
    )
  })

  it('scores a partial refusal as a miss rather than dropping it', function () {
    expect(calculate_hit_rate({ hits: 4, total: 16, ungradable: 4 })).to.equal(
      0.25
    )
  })

  it('is a real zero when every game was graded and none hit', function () {
    expect(calculate_hit_rate({ hits: 0, total: 12, ungradable: 0 })).to.equal(
      0
    )
  })

  // The two zeros above are the whole point: one means "never hit" and the other
  // means "never graded", and before this change both rendered as 0.0000.
  it('distinguishes never-hit from never-graded', function () {
    const never_hit = calculate_hit_rate({ hits: 0, total: 12, ungradable: 0 })
    const never_graded = calculate_hit_rate({
      hits: 0,
      total: 12,
      ungradable: 12
    })

    expect(never_hit).to.not.equal(never_graded)
    expect(never_hit).to.equal(0)
    expect(never_graded).to.equal(null)
  })

  it('grades a full sample normally', function () {
    expect(calculate_hit_rate({ hits: 9, total: 12, ungradable: 0 })).to.equal(
      0.75
    )
  })

  // The third case, and the largest. Zero games is not zero hits: a rookie has no
  // last_season games and a week-1 selection has no current_season games. This
  // branch is shared by every market type, so it dwarfs the ungraded ones --
  // dry-run measurement on 2026-09-04 found last_season empty for 109,936 of
  // 961,142 selections in 2024 and 147,190 of 1,077,380 in 2025.
  it('has no rate when the sample is empty', function () {
    expect(calculate_hit_rate({ hits: 0, total: 0, ungradable: 0 })).to.equal(
      null
    )
  })

  it('distinguishes never-hit from no-games-at-all', function () {
    const never_hit = calculate_hit_rate({ hits: 0, total: 12, ungradable: 0 })
    const no_games = calculate_hit_rate({ hits: 0, total: 0, ungradable: 0 })

    expect(never_hit).to.not.equal(no_games)
    expect(never_hit).to.equal(0)
    expect(no_games).to.equal(null)
  })
})

// The larger half of the same defect, on the branch that does NOT go through
// settlement's derivation. A market type with no case in selection-result.mjs
// reaches its `default` and gets null back, which `is_hit` collapsed to false --
// so every game scored a loss and the selection stored 0.0000 on a market
// nothing had ever graded.
//
// The market types are enumerated from the code that defines the class rather
// than from the names of the first symptoms, so a type that joins the ungraded
// set later fails here instead of silently inheriting the bug.
describe('hit rate over a market type no grader has a rule for', function () {
  // Every market type reachable on the non-gamelog branch that selection-result
  // has no case for. Absent from market_type_mappings or mapped to NFL_PLAYS
  // makes no difference: neither reaches a case.
  const uncased_market_types = [
    'GAME_FIRST_TEAM_TOUCHDOWN_SCORER',
    'GAME_TACKLES_ASSISTS',
    'GAME_PPR_FANTASY_POINTS',
    'GAME_LAST_TOUCHDOWN_SCORER',
    'GAME_FIRST_TOUCHDOWN_SCORER',
    'GAME_FIRST_QUARTER_RECEPTIONS'
  ]

  const sample = [
    { esbid: 2025090700, receptions: 8, receiving_touchdowns: 2, targets: 11 },
    { esbid: 2025090701, receptions: 3, receiving_touchdowns: 0, targets: 4 }
  ]

  // Guards the fixture rather than the fix. If a type below gains a case or a
  // gamelog mapping, it stops exercising this branch and the assertions beneath
  // would pass without reaching the code they name.
  it('exercises types that genuinely reach the default branch', function () {
    for (const market_type of uncased_market_types) {
      expect(
        market_type_mappings[market_type]?.handler,
        `${market_type} is graded from a gamelog and no longer reaches this branch`
      ).to.not.equal('PLAYER_GAMELOG')

      expect(
        get_selection_result({
          line: 0.5,
          market_type,
          player_gamelog: sample[0],
          strict: true,
          selection_type: 'OVER'
        }),
        `${market_type} now has a case in selection-result.mjs`
      ).to.equal(null)
    }
  })

  it('refuses every game rather than scoring it a loss', function () {
    for (const market_type of uncased_market_types) {
      const result = get_hits({
        line: 0.5,
        market_type,
        player_gamelogs: sample,
        strict: true,
        selection_type: 'OVER'
      })

      expect(result.ungradable, market_type).to.equal(sample.length)
      expect(result.hits.length, market_type).to.equal(0)
    }
  })

  // The assertion that would have caught the shipped defect: the stored rate for
  // such a sample must be absent, not zero.
  it('stores no rate for a market type nothing can grade', function () {
    for (const market_type of uncased_market_types) {
      const { hits, ungradable } = get_hits({
        line: 0.5,
        market_type,
        player_gamelogs: sample,
        strict: true,
        selection_type: 'OVER'
      })

      expect(
        calculate_hit_rate({
          hits: hits.length,
          total: sample.length,
          ungradable
        }),
        market_type
      ).to.equal(null)
    }
  })

  // The control: a type the switch DOES have a case for must still grade, or the
  // change above would read as correct while having silenced every market type.
  it('still grades a market type the switch has a rule for', function () {
    const { hits, ungradable } = get_hits({
      line: 0.5,
      market_type: 'GAME_RECEIVING_TARGETS',
      player_gamelogs: sample,
      strict: true,
      selection_type: 'OVER'
    })

    expect(ungradable).to.equal(0)
    expect(hits.length).to.equal(2)
    expect(
      calculate_hit_rate({
        hits: hits.length,
        total: sample.length,
        ungradable
      })
    ).to.equal(1)
  })
})
