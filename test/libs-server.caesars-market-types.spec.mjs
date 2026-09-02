/* global describe, it */

import * as chai from 'chai'

import {
  get_market_type,
  caesars_market_type_by_template
} from '#libs-server/caesars/caesars-market-types.mjs'
import {
  player_prop_types,
  team_game_market_types,
  team_grain_market_types,
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
      ],

      // The kicking family. '|Player Total Made Field Goals|' is the one that
      // needed no new constant -- GAME_FIELD_GOALS_MADE already existed and
      // was simply never wired to a template.
      ['|Player Total Kicking Points|', player_prop_types.GAME_KICKING_POINTS],
      [
        '|Player Total Made Field Goals|',
        player_prop_types.GAME_FIELD_GOALS_MADE
      ],
      [
        '|Player Total Made Extra Points|',
        player_prop_types.GAME_EXTRA_POINTS_MADE
      ],
      ['|Alt Kicking Points|', player_prop_types.GAME_ALT_KICKING_POINTS],
      ['|Alt Made Field Goals|', player_prop_types.GAME_ALT_FIELD_GOALS_MADE],
      ['|Alt Made Extra Points|', player_prop_types.GAME_ALT_EXTRA_POINTS_MADE],

      // The period-scoped game lines. Caesars renamed its second-half markets
      // between eras, so both name forms must reach the same type -- a pair
      // that a per-name check would pass while typing only half the rows.
      [
        '|1st Half Money Line|',
        team_game_market_types.GAME_FIRST_HALF_MONEYLINE
      ],
      ['|1st Half Total Points|', team_game_market_types.GAME_FIRST_HALF_TOTAL],
      ['|2nd Half Spread|', team_game_market_types.GAME_SECOND_HALF_SPREAD],
      [
        '|2nd Half Spread (Inc. OT)|',
        team_game_market_types.GAME_SECOND_HALF_SPREAD
      ],
      [
        '|2nd Half Money Line|',
        team_game_market_types.GAME_SECOND_HALF_MONEYLINE
      ],
      [
        '|2nd Half Total Points|',
        team_game_market_types.GAME_SECOND_HALF_TOTAL
      ],
      [
        '|2nd Half Total Points (Inc. OT)|',
        team_game_market_types.GAME_SECOND_HALF_TOTAL
      ],
      [
        '|1st Quarter Money Line|',
        team_game_market_types.GAME_FIRST_QUARTER_MONEYLINE
      ],
      [
        '|1st Quarter Spread|',
        team_game_market_types.GAME_FIRST_QUARTER_SPREAD
      ],
      [
        '|1st Quarter Total Points|',
        team_game_market_types.GAME_FIRST_QUARTER_TOTAL
      ],

      // Deliberately absent, and asserted so a later session does not add them
      // on the symmetry argument alone: the second, third and fourth quarter
      // lines hold four stored rows each and stopped arriving 2025-02-07.
      ['|2nd Quarter Money Line|', null],
      ['|3rd Quarter Spread|', null],
      ['|4th Quarter Total Points|', null]
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

  describe('the team statistic totals', function () {
    // Every one of these is one market per team from one template, with bare
    // over/under selections and the team carried only by a market-name prefix.
    // Typing them without also attributing the team collapses the two teams
    // onto one key, so the grain of the constant is load-bearing, not cosmetic.
    const team_grain_templates = [
      '|Team Total Team Touchdowns|',
      '|Team Total Team Offense Touchdowns|',
      '|Team Total Team Passing Yards|',
      '|Team Total Team Passing Touchdowns|',
      '|Team Total Team Rushing Yards|',
      '|Team Total Team Rushing Touchdowns|',
      '|Team Total Team Rushing Attempts|',
      '|Team Total Team Receiving Yards|',
      '|Team Total Team Receiving Touchdowns|',
      '|Team Total Team Receptions|'
    ]

    it('maps each one to a TEAM-grain type', function () {
      for (const template_name of team_grain_templates) {
        const market_type = get_market_type({ template_name })
        expect(market_type, template_name).to.be.a('string')
        expect(
          team_grain_market_types.has(market_type),
          template_name
        ).to.equal(true)
      }
    })

    it('gives the two touchdown templates DIFFERENT types', function () {
      // They differ on whether defensive and special-teams scores count.
      // Collapsing them would grade one against the other's total.
      expect(
        get_market_type({ template_name: '|Team Total Team Touchdowns|' })
      ).to.not.equal(
        get_market_type({
          template_name: '|Team Total Team Offense Touchdowns|'
        })
      )
    })

    it('leaves the tackles template a no-map carrying its reason', function () {
      const template_name = '|Team Total Team Defensive Tackles|'
      expect(get_market_type({ template_name })).to.equal(null)
      expect(caesars_market_type_by_template[template_name].reason).to.be.a(
        'string'
      )
    })

    it('does not type the live variant of a template it now knows', function () {
      expect(
        get_market_type({
          template_name: '|Team Total Team Rushing Touchdowns Live|'
        })
      ).to.equal(null)
      expect(
        get_market_type({
          template_name: '|Team Total Team Rushing Touchdowns|'
        })
      ).to.equal(team_game_market_types.GAME_TEAM_RUSHING_TOUCHDOWNS)
    })

    it('types Total Match Field Goals as GAME grain, not team grain', function () {
      // It reads like the family above and was swept into its census by a
      // regex, but its market name carries no team prefix and it covers both
      // teams. A team-grain type here would make the importer look for a team
      // that is not in the name.
      const market_type = get_market_type({
        template_name: '|Total Match Field Goals|'
      })
      expect(market_type).to.equal(
        team_game_market_types.GAME_TOTAL_FIELD_GOALS_MADE
      )
      expect(team_grain_market_types.has(market_type)).to.equal(false)
    })
  })

  describe('there is no market_category fallback', function () {
    // The retired category switch had never typed a market: of 451,674 stored
    // Caesars rows only 16 have a template segment falsy enough to have reached
    // it and none of the 16 is typed, and on a live payload the only markets
    // without a `templateName` are empty market objects carrying no
    // `marketCategory` either. These pin that a category alone types nothing,
    // so a caller cannot come to depend on a branch that was deleted.
    it('types nothing on a category when there is no template', function () {
      expect(get_market_type({ market_category: 'PASSING_YARDS' })).to.equal(
        null
      )
    })

    it('types nothing on a category when the template is an empty string', function () {
      expect(
        get_market_type({
          template_name: '',
          market_category: 'PASSING_YARDS'
        })
      ).to.equal(null)
    })

    it('types nothing on a category when the template misses', function () {
      expect(
        get_market_type({
          template_name: '|No Such Market|',
          market_category: 'PASSING_YARDS'
        })
      ).to.equal(null)
    })
  })

  describe('the table', function () {
    // A key PRESENT with a null type is a deliberate no-map carrying its
    // reason; a key ABSENT is a family nobody has looked at. Both return null
    // from get_market_type, which is why the distinction has to be asserted on
    // the table rather than through the function.
    it('agrees with get_market_type on every key it holds', function () {
      for (const [template_name, entry] of Object.entries(
        caesars_market_type_by_template
      )) {
        expect(get_market_type({ template_name })).to.equal(entry.market_type)
      }
    })

    it('distinguishes a deliberate no-map from an absent template', function () {
      const no_map_keys = Object.entries(caesars_market_type_by_template)
        .filter(([, entry]) => entry.market_type === null)
        .map(([template_name]) => template_name)

      for (const template_name of no_map_keys) {
        expect(get_market_type({ template_name })).to.equal(null)
        expect(caesars_market_type_by_template[template_name].reason).to.be.a(
          'string'
        )
      }

      expect(caesars_market_type_by_template).to.not.have.property(
        '|No Such Market|'
      )
    })

    it('does not resolve a template name off Object.prototype', function () {
      expect(get_market_type({ template_name: 'constructor' })).to.equal(null)
      expect(get_market_type({ template_name: 'toString' })).to.equal(null)
    })
  })

  it('returns null when given neither a template nor a category', function () {
    expect(get_market_type({})).to.equal(null)
  })
})
