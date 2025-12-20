/* global describe before it beforeEach afterEach */
import * as chai from 'chai'

import knex from '#db'
import league_seed from '#db/seeds/league.mjs'
import { current_season } from '#constants'
import {
  bookmakers,
  player_game_prop_types
} from '#libs-shared/bookmaker-constants.mjs'
import { load_market_projections } from '#libs-server/simulation/load-market-projections.mjs'
import { load_game_environment } from '#libs-server/simulation/load-game-environment.mjs'
import { getLeague } from '#libs-server'

const expect = chai.expect

describe('LIBS-SERVER simulation integration', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('load_market_projections', function () {
    const test_player_id = 'TEST-PLAYER-001'
    const test_week = 1
    const test_year = current_season.year
    const test_esbid = 123456789

    beforeEach(async function () {
      // Set up league
      await league_seed(knex)

      // Create test player
      await knex('player').insert({
        pid: test_player_id,
        pname: 'TestPlayer',
        fname: 'Test',
        lname: 'Player',
        formatted: 'testplayer',
        dob: '1995-01-01',
        pos: 'QB',
        pos1: 'QB',
        current_nfl_team: 'KC',
        nfl_draft_year: 2018
      })

      // Create test NFL game
      await knex('nfl_games').insert({
        esbid: test_esbid,
        week: test_week,
        year: test_year,
        seas_type: 'REG',
        v: 'DEN',
        h: 'KC',
        time_est: '13:00:00'
      })
    })

    afterEach(async function () {
      // Clean up test data
      await knex('prop_market_selections_index').del()
      await knex('prop_markets_index').del()
      await knex('nfl_games').where({ esbid: test_esbid }).del()
      await knex('player').where({ pid: test_player_id }).del()
    })

    it('should load market projections and convert to fantasy points', async function () {
      // Insert prop market for passing yards
      await knex('prop_markets_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-1',
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-1',
        source_selection_id: 'test-selection-1',
        selection_pid: test_player_id,
        selection_metric_line: 275.5,
        selection_type: 'OVER',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      const league = await getLeague({ lid: 1 })
      const result = await load_market_projections({
        player_ids: [test_player_id],
        week: test_week,
        year: test_year,
        league
      })

      expect(result.size).to.equal(1)
      expect(result.has(test_player_id)).to.equal(true)

      const projection = result.get(test_player_id)
      expect(projection.stats.py).to.equal(275.5)
      expect(projection.source).to.include('FANDUEL')
      expect(projection.market_types).to.include(
        player_game_prop_types.GAME_PASSING_YARDS
      )
      // Fantasy points should be calculated (275.5 * 0.04 = 11.02 for standard scoring)
      expect(projection.projection).to.be.a('number')
      expect(projection.projection).to.be.greaterThan(0)
    })

    it('should prefer FanDuel over DraftKings when both available', async function () {
      // Insert FanDuel market
      await knex('prop_markets_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-fd',
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-fd',
        source_selection_id: 'test-selection-fd',
        selection_pid: test_player_id,
        selection_metric_line: 280.0,
        selection_type: 'OVER',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      // Insert DraftKings market with different line
      await knex('prop_markets_index').insert({
        source_id: bookmakers.DRAFTKINGS,
        source_market_id: 'test-market-dk',
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.DRAFTKINGS,
        source_market_id: 'test-market-dk',
        source_selection_id: 'test-selection-dk',
        selection_pid: test_player_id,
        selection_metric_line: 275.0,
        selection_type: 'OVER',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      const league = await getLeague({ lid: 1 })
      const result = await load_market_projections({
        player_ids: [test_player_id],
        week: test_week,
        year: test_year,
        league
      })

      expect(result.size).to.equal(1)
      const projection = result.get(test_player_id)
      // Should use FanDuel line (280.0), not DraftKings (275.0)
      expect(projection.stats.py).to.equal(280.0)
    })

    it('should return empty map for players with no market data', async function () {
      const league = await getLeague({ lid: 1 })
      const result = await load_market_projections({
        player_ids: [test_player_id],
        week: test_week,
        year: test_year,
        league
      })

      expect(result.size).to.equal(0)
    })

    it('should return empty map for empty player_ids array', async function () {
      const league = await getLeague({ lid: 1 })
      const result = await load_market_projections({
        player_ids: [],
        week: test_week,
        year: test_year,
        league
      })

      expect(result.size).to.equal(0)
    })

    it('should throw error when league is not provided', async function () {
      try {
        await load_market_projections({
          player_ids: [test_player_id],
          week: test_week,
          year: test_year,
          league: null
        })
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.include('league settings required')
      }
    })

    it('should combine multiple stat types into single projection', async function () {
      // Insert passing yards market
      await knex('prop_markets_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-py',
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-py',
        source_selection_id: 'test-selection-py',
        selection_pid: test_player_id,
        selection_metric_line: 275.5,
        selection_type: 'OVER',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      // Insert passing TDs market
      await knex('prop_markets_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-td',
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_PASSING_TOUCHDOWNS,
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-market-td',
        source_selection_id: 'test-selection-td',
        selection_pid: test_player_id,
        selection_metric_line: 2.5,
        selection_type: 'OVER',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      const league = await getLeague({ lid: 1 })
      const result = await load_market_projections({
        player_ids: [test_player_id],
        week: test_week,
        year: test_year,
        league
      })

      expect(result.size).to.equal(1)
      const projection = result.get(test_player_id)
      expect(projection.stats.py).to.equal(275.5)
      expect(projection.stats.tdp).to.equal(2.5)
      expect(projection.market_types).to.have.lengthOf(2)
      // Projection should include points from both stats
      expect(projection.projection).to.be.greaterThan(11) // More than just passing yards
    })
  })

  describe('load_game_environment', function () {
    const test_esbid = 234567890
    const test_week = 1
    const test_year = current_season.year

    beforeEach(async function () {
      // Create test NFL game
      await knex('nfl_games').insert({
        esbid: test_esbid,
        week: test_week,
        year: test_year,
        seas_type: 'REG',
        v: 'DEN',
        h: 'KC',
        time_est: '13:00:00'
      })
    })

    afterEach(async function () {
      // Clean up test data
      await knex('prop_market_selections_index').del()
      await knex('prop_markets_index').del()
      await knex('nfl_games').where({ esbid: test_esbid }).del()
    })

    it('should load game total from market data', async function () {
      // Insert game total market
      await knex('prop_markets_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-total-market',
        esbid: test_esbid,
        market_type: 'GAME_TOTAL',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-total-market',
        source_selection_id: 'test-total-selection',
        selection_metric_line: 48.5,
        selection_type: 'OVER',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      const result = await load_game_environment({
        esbids: [test_esbid],
        week: test_week,
        year: test_year
      })

      expect(result.size).to.equal(1)
      expect(result.has(test_esbid)).to.equal(true)

      const game_env = result.get(test_esbid)
      expect(game_env.game_total).to.equal(48.5)
    })

    it('should load game spread from market data', async function () {
      // Insert game spread market
      await knex('prop_markets_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-spread-market',
        esbid: test_esbid,
        market_type: 'GAME_SPREAD',
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000),
        selection_count: 2
      })

      // Home team (KC) spread
      await knex('prop_market_selections_index').insert({
        source_id: bookmakers.FANDUEL,
        source_market_id: 'test-spread-market',
        source_selection_id: 'test-spread-selection-home',
        selection_name: 'KC -3.5',
        selection_metric_line: -3.5,
        time_type: 'CLOSE',
        timestamp: Math.floor(Date.now() / 1000)
      })

      const result = await load_game_environment({
        esbids: [test_esbid],
        week: test_week,
        year: test_year
      })

      expect(result.size).to.equal(1)
      const game_env = result.get(test_esbid)
      expect(game_env.home_spread).to.equal(-3.5)
    })

    it('should return null values for games with no market data', async function () {
      const result = await load_game_environment({
        esbids: [test_esbid],
        week: test_week,
        year: test_year
      })

      expect(result.size).to.equal(1)
      const game_env = result.get(test_esbid)
      expect(game_env.game_total).to.equal(null)
      expect(game_env.home_spread).to.equal(null)
      expect(game_env.away_spread).to.equal(null)
    })

    it('should return empty map for empty esbids array', async function () {
      const result = await load_game_environment({
        esbids: [],
        week: test_week,
        year: test_year
      })

      expect(result.size).to.equal(0)
    })
  })
})
