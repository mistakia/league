/* global describe it */
import * as chai from 'chai'
import fs from 'node:fs'

import {
  resolve_market_type,
  get_option_selection_line,
  get_team_from_selection_name,
  format_selection_type,
  is_placeholder_option,
  strip_trailing_line,
  PLAYER_AWARD_MARKET_TYPES
} from '#libs-server/betmgm/index.mjs'
import { awards_prop_types } from '#libs-shared/bookmaker-constants.mjs'

const expect = chai.expect

/*
  BetMGM market typing and per-selection derivation.

  Fixture is a trimmed copy of a live 2026-09-02 payload, one market per shape,
  committed because the full dumps live in user-base's gitignored scratch tier.

  Three things here are not obvious and each cost a real defect:

  - A result-level `playerId` is not evidence of a player. It appears on
    division-winner selections (which name TEAMS) and on 'Super Bowl: Winning
    state' selections (which name US STATES), and is ABSENT from every season
    player prop. So the market, not the field, decides selection identity.

  - The spread line comes from the market-level `DecimalHandicap` parameter and
    is the HOME side's line, with the away side taking its negation. It is
    positive exactly on away-favorite games, so neither array order nor a
    favorite-side assumption reproduces it.

  - A period-scoped market must never resolve to a full-game type. GAME_MONEYLINE
    and GAME_TOTAL are wired to the NFL_GAMES settlement handler, which grades
    against the full-game result, and settlement runs on a crontab with no human
    in the loop.
*/

const fixture = JSON.parse(
  fs.readFileSync('./test/fixtures/betmgm-markets-sample.json', 'utf8')
)

const get_param = (market, key) =>
  market.parameters?.find((p) => p.key === key)?.value

const resolve_option = (market) =>
  resolve_market_type({
    source_market_type: get_param(market, 'MarketType'),
    market_name: market.name?.value
  })

const resolve_game = (market) =>
  resolve_market_type({
    template_id: market.templateId,
    market_name: market.name?.value
  })

describe('libs-server/betmgm market types', function () {
  describe('option markets', function () {
    it('types the three settlement-wired full-game families', function () {
      expect(
        resolve_option(fixture.option_markets.moneyline).market_type
      ).to.equal('GAME_MONEYLINE')
      expect(
        resolve_option(fixture.option_markets.spread_home_favorite).market_type
      ).to.equal('GAME_SPREAD')
      expect(resolve_option(fixture.option_markets.total).market_type).to.equal(
        'GAME_TOTAL'
      )
    })

    it('never types a period market as its full-game sibling', function () {
      const { market_type } = resolve_option(
        fixture.option_markets.first_half_moneyline
      )

      expect(market_type).to.equal('GAME_FIRST_HALF_MONEYLINE')
      expect(market_type).to.not.equal('GAME_MONEYLINE')
    })

    it('separates team grain from game grain on the same remainder', function () {
      expect(
        resolve_option(fixture.option_markets.team_total).market_type
      ).to.equal('GAME_TEAM_TOTAL')
      expect(resolve_option(fixture.option_markets.total).market_type).to.equal(
        'GAME_TOTAL'
      )
    })

    // Both grains of 'Total TDs O/U' resolve, and to DIFFERENT types. The
    // game-grain one used to sit on OPTION_KNOWN_UNTYPED_NAMES under a comment
    // justifying that list as period-scoped variants -- but it is Period
    // FullTime, so the justification did not hold and the entry silently
    // suppressed the unknown-descriptor detector for the family.
    it('types both grains of the total-touchdowns family', function () {
      expect(
        resolve_market_type({
          source_market_type: 'Over/Under',
          market_name: 'Total TDs O/U'
        }).market_type
      ).to.equal('GAME_TOTAL_TOUCHDOWNS')

      expect(
        resolve_market_type({
          source_market_type: 'Over/Under',
          market_name: 'Los Angeles Rams: Total TDs O/U'
        }).market_type
      ).to.equal('GAME_TEAM_TOUCHDOWNS')
    })

    // Suppressed at the vendor MarketType level, which is coarser than the
    // name-keyed lists -- so every market published under that MarketType went
    // untyped regardless of name, while GAME_HIGHEST_SCORING_QUARTER existed in
    // the catalog the whole time and Caesars already mapped to it.
    it('types the highest-scoring-quarter family', function () {
      expect(
        resolve_market_type({
          source_market_type: 'MultiplePeriodsWithMostHappenings2Way',
          market_name: 'Highest scoring quarter'
        }).market_type
      ).to.equal('GAME_HIGHEST_SCORING_QUARTER')
    })

    it('reports a reviewed untyped family as known, not unknown', function () {
      const { market_type, is_known } = resolve_option(
        fixture.option_markets.happening_band
      )

      expect(market_type).to.equal(null)
      expect(is_known).to.equal(true)
    })

    it('reports an unseen descriptor as unknown', function () {
      const { market_type, is_known } = resolve_market_type({
        source_market_type: '2way',
        market_name: 'Match winner (renamed by the vendor)'
      })

      expect(market_type).to.equal(null)
      expect(is_known).to.equal(false)
    })
  })

  describe('game markets', function () {
    it('types season player props by templateId', function () {
      expect(
        resolve_game(fixture.game_markets.season_player_prop).market_type
      ).to.equal('SEASON_PASSING_YARDS')
    })

    it('types season leader markets by templateId', function () {
      expect(
        resolve_game(fixture.game_markets.season_leader).market_type
      ).to.equal('SEASON_LEADER_PASSING_YARDS')
    })

    it('types division winners as futures', function () {
      expect(
        resolve_game(fixture.game_markets.division_winner).market_type
      ).to.equal('DIVISION_WINNER')
    })
  })

  describe('the playerId trap, in both directions', function () {
    it('resolves a division-winner selection to a TEAM despite its playerId', function () {
      const result = fixture.game_markets.division_winner.results[0]

      expect(result.playerId).to.be.a('number')
      expect(get_team_from_selection_name(result.name.value)).to.equal('BUF')
    })

    it('resolves no team for a US state, which also carries a playerId', function () {
      const result = fixture.game_markets.winning_state.results[0]

      expect(result.playerId).to.be.a('number')
      expect(get_team_from_selection_name(result.name.value)).to.equal(null)
    })

    it('resolves no team for a player name', function () {
      const result = fixture.game_markets.season_leader.results[0]

      expect(get_team_from_selection_name(result.name.value)).to.equal(null)
    })
  })

  describe('team name resolution', function () {
    it('resolves a single-word-city team, which the DraftKings validator rejects', function () {
      expect(get_team_from_selection_name('Philadelphia Eagles')).to.equal(
        'PHI'
      )
      expect(get_team_from_selection_name('Chicago Bears')).to.equal('CHI')
      expect(get_team_from_selection_name('Washington Commanders')).to.equal(
        'WAS'
      )
    })

    it('resolves a bare nickname and a numeric team name', function () {
      expect(get_team_from_selection_name('Bills')).to.equal('BUF')
      expect(get_team_from_selection_name('San Francisco 49ers')).to.equal('SF')
    })

    it('returns null rather than the INA fallback on empty input', function () {
      expect(get_team_from_selection_name(null)).to.equal(null)
      expect(get_team_from_selection_name('')).to.equal(null)
    })

    // The defect this guards was shipped, not hypothetical. fixTeam resolves
    // ABBREVIATIONS as well as names, 'No' IS the New Orleans Saints to it, and
    // the resolver ran on every selection of every Yes/No market -- so the No
    // side of 59 selections on a 2026-09-02 payload was stamped with the Saints,
    // across TEAM_TO_MAKE_PLAYOFFS, GAME_BOTH_TEAMS_TO_SCORE and GAME_OVERTIME.
    it('refuses an outcome word that is also a team abbreviation', function () {
      expect(get_team_from_selection_name('No')).to.equal(null)
      expect(get_team_from_selection_name('Yes')).to.equal(null)
    })

    // 'Yes' returned null before the guard too -- because no team is
    // abbreviated YES, which is luck. Paired with the 'No' case above so a
    // change that only special-cased the one word it had seen cannot pass:
    // these are abbreviations of real teams and must be refused on shape.
    it('refuses a bare team abbreviation, which BetMGM never writes', function () {
      expect(get_team_from_selection_name('NE')).to.equal(null)
      expect(get_team_from_selection_name('LA')).to.equal(null)
      expect(get_team_from_selection_name('TB')).to.equal(null)
    })

    // fixTeam answers for tokens that name no franchise and therefore no row in
    // `player`, and 'Super Bowl: Winning conference' lists exactly these two as
    // its selections -- so both were written as a selection_pid referencing
    // nothing.
    it('refuses a conference, which is not a player row', function () {
      expect(get_team_from_selection_name('AFC')).to.equal(null)
      expect(get_team_from_selection_name('NFC')).to.equal(null)
    })

    // The control for the length guard. A guard set one character higher would
    // pass every case above while silently dropping two real teams, and nothing
    // else here would notice.
    it('still resolves the shortest real team nicknames', function () {
      expect(get_team_from_selection_name('Jets')).to.equal('NYJ')
      expect(get_team_from_selection_name('Rams')).to.equal('LA')
    })
  })

  describe('line derivation', function () {
    it('strips a trailing line without eating the 49 in 49ers', function () {
      expect(strip_trailing_line('San Francisco 49ers +3.5')).to.equal(
        'San Francisco 49ers'
      )
      expect(strip_trailing_line('Kansas City Chiefs (-3)')).to.equal(
        'Kansas City Chiefs'
      )
      expect(strip_trailing_line('San Francisco 49ers')).to.equal(
        'San Francisco 49ers'
      )
    })

    it('gives the home side the handicap and the away side its negation', function () {
      const market = fixture.option_markets.spread_home_favorite
      const handicap = Number.parseFloat(get_param(market, 'DecimalHandicap'))
      expect(handicap).to.be.below(0)

      const home_team = get_team_from_selection_name(
        market.options.find(
          (option) =>
            get_team_from_selection_name(option.name.value) !== null &&
            option.name.value.includes('-')
        ).name.value
      )
      const nfl_game = { home_nfl_team: home_team, away_nfl_team: 'ZZZ' }

      const lines = market.options.map((option) =>
        get_option_selection_line({ betmgm_market: market, option, nfl_game })
      )
      const home_line = lines.find((line) => line === handicap)

      expect(home_line).to.equal(handicap)
    })

    it('handles the away-favorite case, where the handicap is positive', function () {
      const market = fixture.option_markets.spread_away_favorite
      const handicap = Number.parseFloat(get_param(market, 'DecimalHandicap'))

      expect(handicap).to.be.above(0)

      const home_option = market.options.find((option) =>
        option.name.value.includes('+')
      )
      const away_option = market.options.find((option) =>
        option.name.value.includes('-')
      )
      const home_team = get_team_from_selection_name(home_option.name.value)
      const away_team = get_team_from_selection_name(away_option.name.value)
      const nfl_game = { home_nfl_team: home_team, away_nfl_team: away_team }

      expect(
        get_option_selection_line({
          betmgm_market: market,
          option: home_option,
          nfl_game
        })
      ).to.equal(handicap)

      // The away side is the FAVORITE here, so its line is negative.
      expect(
        get_option_selection_line({
          betmgm_market: market,
          option: away_option,
          nfl_game
        })
      ).to.equal(-handicap)
    })

    it('shares one line across both sides of a total', function () {
      const market = fixture.option_markets.total
      const lines = market.options.map((option) =>
        get_option_selection_line({
          betmgm_market: market,
          option,
          nfl_game: null
        })
      )

      expect(new Set(lines).size).to.equal(1)
      expect(lines[0]).to.equal(
        Number.parseFloat(get_param(market, 'DecimalValue'))
      )
    })

    it('returns no line when the side cannot be identified', function () {
      const market = fixture.option_markets.spread_home_favorite

      expect(
        get_option_selection_line({
          betmgm_market: market,
          option: market.options[0],
          nfl_game: { home_nfl_team: 'ZZZ', away_nfl_team: 'YYY' }
        })
      ).to.equal(null)
    })

    it('parses a mixed-precision handicap as a float', function () {
      const market = {
        parameters: [{ key: 'DecimalHandicap', value: '-2.5000' }]
      }
      const nfl_game = { home_nfl_team: 'CIN', away_nfl_team: 'TB' }
      const option = { name: { value: 'Cincinnati Bengals -2.5' } }

      expect(
        get_option_selection_line({ betmgm_market: market, option, nfl_game })
      ).to.equal(-2.5)
    })
  })

  describe('selection shape', function () {
    it('reads over/under direction', function () {
      expect(format_selection_type('Over 48.5')).to.equal('OVER')
      expect(format_selection_type('Under 48.5')).to.equal('UNDER')
      expect(format_selection_type('Los Angeles Rams -3.5')).to.equal(null)
    })

    it('identifies an unpriced placeholder option', function () {
      expect(is_placeholder_option({ price: { id: 1, odds: 1 } })).to.equal(
        true
      )
      expect(
        is_placeholder_option({ price: { odds: 1.9, americanOdds: -110 } })
      ).to.equal(false)
    })
  })

  /*
    The award families list a bare player name per selection, exactly as the
    leader boards do, and were left off the player-matching arm when the leader
    templates were wired -- 490 selections carrying no selection_pid while the
    structurally identical leader markets resolved.

    The two exclusions are the cases worth pinning. A coach has no player row, so
    a name lookup returns null for most of the field and a WRONG pid for any
    coach sharing a name with a player; and MVP_AND_SUPER_BOWL_WINNER names a
    player AND a team in one selection, which a scalar pid cannot represent.
  */
  describe('player award families', function () {
    const award_market_type = (name) =>
      resolve_market_type({ template_id: null, market_name: name }).market_type

    it('routes the six player awards to the bare-name matcher', function () {
      const names = [
        'AP MVP winner',
        'AP Offensive Player of the Year',
        'AP Defensive Player of the Year',
        'AP Offensive Rookie of the Year',
        'AP Defensive Rookie of the Year',
        'AP Comeback Player of the Year'
      ]

      for (const name of names) {
        const market_type = award_market_type(name)
        expect(market_type, name).to.be.a('string')
        expect(PLAYER_AWARD_MARKET_TYPES.has(market_type), name).to.equal(true)
      }
    })

    it('excludes coach of the year, whose selections are not players', function () {
      const market_type = award_market_type('AP Coach of the Year')

      expect(market_type).to.equal(awards_prop_types.COACH_OF_THE_YEAR)
      expect(PLAYER_AWARD_MARKET_TYPES.has(market_type)).to.equal(false)
    })

    it('excludes the compound award, which names a player AND a team', function () {
      expect(
        PLAYER_AWARD_MARKET_TYPES.has(
          awards_prop_types.MVP_AND_SUPER_BOWL_WINNER
        )
      ).to.equal(false)
    })

    it('resolves no team for an award selection, which names a player', function () {
      expect(get_team_from_selection_name('Patrick Mahomes')).to.equal(null)
      expect(get_team_from_selection_name('Micah Parsons')).to.equal(null)
    })
  })
})
