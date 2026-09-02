/* global describe, it */

import * as chai from 'chai'

import { get_market_type } from '#libs-server/caesars/caesars-market-types.mjs'
import {
  player_prop_types,
  team_game_market_types,
  game_props_types,
  team_props_types
} from '#libs-shared/bookmaker-constants.mjs'

const expect = chai.expect

// This spec pins the mapping's CURRENT behaviour, ahead of any change to it.
//
// It exists in test/ rather than private/test/ for one reason: private/ is a
// submodule CI never checks out, so a spec importing it aborts the whole suite
// during module load and reports ZERO tests rather than one failure. That is
// the failure mode this file is placed to avoid, and it is why the mapping was
// moved to libs-server/caesars/ first.

describe('libs-server caesars market types', function () {
  describe('the pipe wrap', function () {
    // The Caesars payload delivers templateName already pipe-wrapped and the
    // case labels match that wire form. The importer stores the name with pipes
    // STRIPPED, so a backfill replaying this function over stored names must
    // re-wrap. Measured over all 814 distinct stored templates, the bare form
    // types zero rows and the wrapped form types 23,046.
    it('types a pipe-wrapped template', function () {
      expect(get_market_type({ template_name: '|Match Spread|' })).to.equal(
        team_game_market_types.GAME_SPREAD
      )
    })

    it('returns null for the same template unwrapped', function () {
      expect(get_market_type({ template_name: 'Match Spread' })).to.equal(null)
    })
  })

  describe('template dispatch', function () {
    const cases = [
      ['|Money Line|', team_game_market_types.GAME_MONEYLINE],
      ['|Total Points|', team_game_market_types.GAME_TOTAL],
      ['|1st Half Spread|', team_game_market_types.GAME_FIRST_HALF_SPREAD],
      ['|Total Home Points|', team_game_market_types.GAME_TEAM_TOTAL],
      ['|Total Away Points|', team_game_market_types.GAME_TEAM_TOTAL],
      ['|Team Total Points|', team_game_market_types.GAME_TEAM_TOTAL],
      ['|Player Total Passing Yards|', player_prop_types.GAME_PASSING_YARDS],
      ['|Player Total Receptions|', player_prop_types.GAME_RECEPTIONS],
      [
        '|Player Total Tackles + Assists|',
        player_prop_types.GAME_TACKLES_ASSISTS
      ],
      [
        '|Player Total Rushing + Receiving Yards|',
        player_prop_types.GAME_RUSHING_RECEIVING_YARDS
      ],
      ['|Alt Passing Yards|', player_prop_types.GAME_ALT_PASSING_YARDS],
      ['|Alt Sacks|', player_prop_types.GAME_ALT_DEFENSE_SACKS],
      ['|Anytime Touchdown Scorer|', player_prop_types.ANYTIME_TOUCHDOWN],
      [
        '|Total Regular Season Passing Yards|',
        player_prop_types.SEASON_PASSING_YARDS
      ],
      ['|Will There Be Overtime?|', game_props_types.GAME_OVERTIME],
      ['|Winning Margin|', game_props_types.GAME_WINNING_MARGIN],
      ['|Winning Margins|', game_props_types.GAME_WINNING_MARGIN],
      ['|Double Result|', game_props_types.GAME_HALF_TIME_FULL_TIME],
      [
        '|Highest Scoring Quarter|',
        game_props_types.GAME_HIGHEST_SCORING_QUARTER
      ],
      [
        '|Team Total Points Odd/Even|',
        team_props_types.GAME_TEAM_TOTAL_POINTS_ODD_EVEN
      ],
      [
        '|Team Score First And Win|',
        team_props_types.GAME_TEAM_TO_SCORE_FIRST_AND_WIN
      ]
    ]

    for (const [template_name, expected] of cases) {
      it(`types ${template_name}`, function () {
        expect(get_market_type({ template_name })).to.equal(expected)
      })
    }

    it('returns null for an unknown template', function () {
      expect(get_market_type({ template_name: '|No Such Market|' })).to.equal(
        null
      )
    })
  })

  describe('the live suffix is not handled', function () {
    // Pinning current behaviour, not endorsing it. The live family is a legacy
    // population -- the v4 importer has written none since 2025-09-19 -- and
    // whether these should map at all is an open question on the coverage task.
    // If that lands, this block is what has to change, deliberately.
    it('does not type a live-suffixed template whose pregame twin maps', function () {
      expect(
        get_market_type({ template_name: '|Player Total Receptions Live|' })
      ).to.equal(null)
    })
  })

  describe('category fallback', function () {
    it('types on market_category when there is no template', function () {
      expect(get_market_type({ market_category: 'PASSING_YARDS' })).to.equal(
        player_prop_types.GAME_PASSING_YARDS
      )
    })

    it('returns null for an unknown category', function () {
      expect(get_market_type({ market_category: 'NO_SUCH_CATEGORY' })).to.equal(
        null
      )
    })

    // The template switch's `default` returns null INSIDE the
    // `if (template_name)` block, so a template MISS never reaches the category
    // branch -- only a FALSY template does. A caller that assumes fall-through
    // will mis-attribute which switch graded a market.
    it('does not fall through to the category when a template misses', function () {
      expect(
        get_market_type({
          template_name: '|No Such Market|',
          market_category: 'PASSING_YARDS'
        })
      ).to.equal(null)
    })

    it('does reach the category when the template is an empty string', function () {
      expect(
        get_market_type({
          template_name: '',
          market_category: 'PASSING_YARDS'
        })
      ).to.equal(player_prop_types.GAME_PASSING_YARDS)
    })
  })

  it('returns null when given neither a template nor a category', function () {
    expect(get_market_type({})).to.equal(null)
  })
})
