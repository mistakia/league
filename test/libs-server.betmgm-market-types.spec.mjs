/* global describe it */
import * as chai from 'chai'
import fs from 'node:fs'

import {
  resolve_market_type,
  get_option_selection_line,
  get_team_from_selection_name,
  format_selection_type,
  is_placeholder_option,
  strip_trailing_line
} from '#libs-server/betmgm/index.mjs'

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
})
