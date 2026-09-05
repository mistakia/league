/* global describe, it */

import * as chai from 'chai'

import {
  get_market_type,
  caesars_market_type_by_template,
  FORBIDDEN_TEMPLATE_TABLE_KEYS
} from '#libs-server/caesars/caesars-market-types.mjs'
import {
  player_prop_types,
  team_game_market_types,
  team_grain_market_types,
  game_props_types,
  team_props_types,
  team_season_types,
  season_high_totals_types,
  player_season_prop_types
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

    // THE FOUR COMBINED-STATISTIC TEMPLATES, COINED ON AN OPERATOR RULING.
    //
    // Each must get its OWN type. Reusing a half -- mapping the combined
    // passing-plus-rushing yards market to SEASON_PASSING_YARDS -- would grade a
    // combined line against a passing-only total, which is worse than the null
    // these carried before. So the assertion that matters is that all four are
    // distinct from each other AND from the singles they are built from.
    it('types the four combined-statistic templates distinctly', function () {
      const combined = {
        '|Total Regular Season Passing + Rushing Yards|':
          'SEASON_PASSING_RUSHING_YARDS',
        '|Total Regular Season Passing + Rushing Touchdowns|':
          'SEASON_PASSING_RUSHING_TOUCHDOWNS',
        '|Total Regular Season Rushing + Receiving Yards|':
          'SEASON_RUSHING_RECEIVING_YARDS',
        '|Total Regular Season Rushing + Receiving Touchdowns|':
          'SEASON_RUSHING_RECEIVING_TOUCHDOWNS'
      }

      for (const [template_name, market_type] of Object.entries(combined)) {
        expect(get_market_type({ template_name })).to.equal(market_type)
      }

      const types = Object.values(combined)
      expect(new Set(types).size).to.equal(4)
      for (const single of [
        'SEASON_PASSING_YARDS',
        'SEASON_RUSHING_YARDS',
        'SEASON_RECEIVING_YARDS',
        'SEASON_PASSING_TOUCHDOWNS',
        'SEASON_RUSHING_TOUCHDOWNS',
        'SEASON_RECEIVING_TOUCHDOWNS'
      ]) {
        expect(types).to.not.include(single)
      }
    })

    // They reach the picker through player_season_prop_types, which is what
    // made them an operator decision rather than a free wiring. Asserting the
    // membership keeps a later refactor from quietly moving them into a group
    // that widens nothing and changing what the operator ruled on.
    it('places the combined constants in the group that reaches the picker', function () {
      for (const market_type of [
        'SEASON_PASSING_RUSHING_YARDS',
        'SEASON_PASSING_RUSHING_TOUCHDOWNS',
        'SEASON_RUSHING_RECEIVING_YARDS',
        'SEASON_RUSHING_RECEIVING_TOUCHDOWNS'
      ]) {
        expect(player_season_prop_types).to.have.property(
          market_type,
          market_type
        )
      }
    })

    // THE TWO SIDES OF AN INTERCEPTION SETTLE FROM OPPOSITE COLUMNS.
    //
    // The thrown-side single-game template sat as a no-map whose reason named a
    // column mismatch the constant vocabulary had already resolved:
    // SEASON_LEAGUE_HIGH_SINGLE_GAME_INTERCEPTIONS_THROWN existed and nothing
    // used it. Asserting the two are DIFFERENT is the check that matters --
    // mapping them together would grade quarterbacks against defenders.
    it('keeps the caught and thrown single-game interception markets distinct', function () {
      const caught = get_market_type({
        template_name:
          '|Most Interceptions By Defensive Player In Single Game| |Regular Season - Individual Player|'
      })
      const thrown = get_market_type({
        template_name:
          '|Most Interceptions Thrown In a Single Game| |Regular Season - Individual Player|'
      })

      expect(caught).to.equal('SEASON_LEAGUE_HIGH_SINGLE_GAME_INTERCEPTIONS')
      expect(thrown).to.equal(
        'SEASON_LEAGUE_HIGH_SINGLE_GAME_INTERCEPTIONS_THROWN'
      )
      expect(thrown).to.not.equal(caught)
    })

    // The SEASON-grain thrown market has no constant and stays a no-map. Its
    // reason must not claim the twin above rescues it -- that claim was there
    // and was false.
    it('leaves the season-grain thrown markets untyped with a reason', function () {
      for (const template_name of [
        '|Most Regular Season Interceptions Thrown|',
        '|Most Interceptions Thrown| |Regular Season - Individual Player|'
      ]) {
        expect(get_market_type({ template_name })).to.equal(null)
        expect(caesars_market_type_by_template[template_name].reason).to.be.a(
          'string'
        )
      }
    })

    it('does not resolve a template name off Object.prototype', function () {
      expect(get_market_type({ template_name: 'constructor' })).to.equal(null)
      expect(get_market_type({ template_name: 'toString' })).to.equal(null)
    })
  })

  it('returns null when given neither a template nor a category', function () {
    expect(get_market_type({})).to.equal(null)
  })

  // The futures templates come in two OPPOSITE arrangements, and the lookup
  // order is what keeps them apart. Full key first, subject-stripped retry
  // second.
  describe('segment-aware lookup', function () {
    it('resolves a STATISTIC-FIRST template by its full key', function () {
      expect(
        get_market_type({
          template_name:
            '|Most Passing Yards| |Regular Season - Individual Player|'
        })
      ).to.equal(season_high_totals_types.SEASON_LEAGUE_HIGH_PASSING_YARDS)
    })

    it('keeps the twenty-one statistics sharing a scope DISTINCT', function () {
      // The specific failure a trailing-segment rule would cause: every one of
      // these shares the trailing segment 'Regular Season - Individual Player',
      // so a rule keyed on it would return one type for all of them.
      const shared_scope_templates = Object.keys(
        caesars_market_type_by_template
      ).filter((template_name) =>
        template_name.endsWith('| |Regular Season - Individual Player|')
      )

      expect(shared_scope_templates.length).to.be.at.least(10)

      const resolved = shared_scope_templates
        .map((template_name) => get_market_type({ template_name }))
        .filter((market_type) => market_type !== null)

      expect(new Set(resolved).size).to.equal(resolved.length)
    })

    it('resolves a SUBJECT-FIRST template by stripping its leading segment', function () {
      expect(
        get_market_type({
          template_name: '|Player| |Total Regular Season Passing Yards|'
        })
      ).to.equal(
        get_market_type({
          template_name: '|Total Regular Season Passing Yards|'
        })
      )
    })

    it('resolves a template carrying a live PLAYER NAME through the same retry', function () {
      // templateName is not a closed enum -- the feed embeds real names. The
      // retry is what stops the table having to enumerate players.
      expect(
        get_market_type({
          template_name: '|Nik Bonitto| |Total Regular Season Sacks|'
        })
      ).to.equal(
        get_market_type({ template_name: '|Total Regular Season Sacks|' })
      )
      expect(
        get_market_type({
          template_name: '|Nik Bonitto| |Total Regular Season Sacks|'
        })
      ).to.not.equal(null)
    })

    it('resolves a TEAM template through the same retry', function () {
      expect(
        get_market_type({ template_name: '|Team| |Regular Season Wins|' })
      ).to.equal(team_season_types.TEAM_REGULAR_SEASON_WINS)
    })

    // THE CONTROL FIRES ON THE SPLIT, NOT ON THE TABLE.
    //
    // Asserting that some template maps to some constant would pass identically
    // against the OLD un-segmented lookup for any single-segment key, so it
    // cannot tell the new code from the old. These two assert the retry branch
    // itself: a multi-segment name resolving to exactly what its stripped form
    // resolves to, while the stripped form is NOT itself the full name.
    it('reaches the stripped key only through the retry branch', function () {
      const full = '|Team| |To Make The Playoffs|'
      const stripped = '|To Make The Playoffs|'

      expect(Object.hasOwn(caesars_market_type_by_template, full)).to.equal(
        false
      )
      expect(Object.hasOwn(caesars_market_type_by_template, stripped)).to.equal(
        true
      )
      expect(get_market_type({ template_name: full })).to.equal(
        caesars_market_type_by_template[stripped].market_type
      )
    })

    it('does not strip a SINGLE-segment template', function () {
      // '|Regular Season Wins|' must not be reachable by stripping something
      // that merely ends in it.
      expect(
        get_market_type({
          template_name: '|No Such Prefix Regular Season Wins|'
        })
      ).to.equal(null)
    })

    it('only strips on the exact separator', function () {
      expect(
        get_market_type({ template_name: '|Team||Regular Season Wins|' })
      ).to.equal(null)
      expect(
        get_market_type({ template_name: '|Team|  |Regular Season Wins|' })
      ).to.equal(null)
    })
  })

  // A BARE SCOPE SEGMENT MUST NEVER BE A TABLE KEY.
  //
  // This is the invariant that makes the retry safe. If '|Regular Season -
  // Individual Player|' were ever keyed, every statistic-first template that
  // missed its full key would fall back onto it and be typed identically --
  // silently, since a wrong type is indistinguishable from a right one at the
  // call site.
  describe('forbidden table keys', function () {
    it('names the scope segments that may not be keyed', function () {
      expect(FORBIDDEN_TEMPLATE_TABLE_KEYS).to.include('|Regular Season|')
      expect(FORBIDDEN_TEMPLATE_TABLE_KEYS).to.include(
        '|Regular Season - Individual Player|'
      )
    })

    it('holds none of them in the table', function () {
      for (const forbidden_key of FORBIDDEN_TEMPLATE_TABLE_KEYS) {
        expect(caesars_market_type_by_template).to.not.have.property(
          forbidden_key
        )
      }
    })

    it('leaves a bare scope segment untyped', function () {
      for (const forbidden_key of FORBIDDEN_TEMPLATE_TABLE_KEYS) {
        expect(get_market_type({ template_name: forbidden_key })).to.equal(null)
      }
    })
  })
})
