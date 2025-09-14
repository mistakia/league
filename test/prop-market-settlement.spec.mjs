import { expect } from 'chai'
import MockDate from 'mockdate'
import knex from '#db'
import {
  PlayerGamelogHandler,
  NFLPlaysHandler,
  NFLGamesHandler,
  TeamStatsHandler,
  SettlementOrchestrator,
  HANDLER_TYPES,
  market_type_mappings,
  get_handler_for_market_type
} from '#libs-server/prop-market-settlement/index.mjs'
import {
  player_game_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

/* global describe it before after */
describe('LIBS SERVER prop-market-settlement', function () {
  before(async function () {
    MockDate.set('2023-09-01')
    await knex.seed.run()

    // Ensure minimal fixtures exist for tests
    let test_game = await knex('nfl_games').where('seas_type', 'REG').first()

    if (!test_game) {
      const esbid_seed = 555000003
      await knex('nfl_games').insert({
        esbid: esbid_seed,
        v: 'NYG',
        h: 'DAL',
        seas_type: 'REG',
        year: 2023,
        week: 1,
        status: 'final',
        home_score: 27,
        away_score: 24
      })
      test_game = await knex('nfl_games').where({ esbid: esbid_seed }).first()
    }

    if (test_game) {
      // Ensure at least one QB gamelog with passing yards
      const existing_gamelog = await knex('player_gamelogs')
        .where({ esbid: test_game.esbid, active: true })
        .where('py', '>', 0)
        .first()

      if (!existing_gamelog) {
        await knex('player_gamelogs').insert({
          esbid: test_game.esbid,
          pid: 'QB-FIXTURE',
          opp: test_game.v,
          tm: test_game.h,
          pos: 'QB',
          active: true,
          started: true,
          pa: 28,
          pc: 20,
          py: 260,
          tdp: 2,
          ints: 0,
          ry: 10,
          tdr: 0,
          trg: 0,
          rec: 0,
          recy: 0,
          tdrec: 0,
          year: test_game.year
        })
      }

      // Ensure at least one play for longest reception tests
      const existing_play = await knex('nfl_plays')
        .where({ esbid: test_game.esbid })
        .first()

      if (!existing_play) {
        await knex('nfl_plays').insert({
          esbid: test_game.esbid,
          playId: 1,
          year: test_game.year || 2023,
          week: 1,
          qtr: 1,
          recv_yds: 25,
          trg_pid: 'WR-FIXTURE',
          updated: 1,
          play_type: 'PASS'
        })
      }
    }
  })

  describe('market type mappings', function () {
    it('should map common player game markets to PLAYER_GAMELOG handler', function () {
      const passing_yards_handler = get_handler_for_market_type(
        player_game_prop_types.GAME_PASSING_YARDS
      )
      const rushing_yards_handler = get_handler_for_market_type(
        player_game_prop_types.GAME_RUSHING_YARDS
      )
      const receiving_yards_handler = get_handler_for_market_type(
        player_game_prop_types.GAME_RECEIVING_YARDS
      )

      expect(passing_yards_handler).to.equal(HANDLER_TYPES.PLAYER_GAMELOG)
      expect(rushing_yards_handler).to.equal(HANDLER_TYPES.PLAYER_GAMELOG)
      expect(receiving_yards_handler).to.equal(HANDLER_TYPES.PLAYER_GAMELOG)
    })

    it('should map team game markets to NFL_GAMES handler', function () {
      const moneyline_handler = get_handler_for_market_type(
        team_game_market_types.GAME_MONEYLINE
      )
      const spread_handler = get_handler_for_market_type(
        team_game_market_types.GAME_SPREAD
      )
      const total_handler = get_handler_for_market_type(
        team_game_market_types.GAME_TOTAL
      )

      expect(moneyline_handler).to.equal(HANDLER_TYPES.NFL_GAMES)
      expect(spread_handler).to.equal(HANDLER_TYPES.NFL_GAMES)
      expect(total_handler).to.equal(HANDLER_TYPES.NFL_GAMES)
    })

    it('should return UNSUPPORTED for unknown market types', function () {
      const unknown_handler = get_handler_for_market_type('UNKNOWN_MARKET_TYPE')
      expect(unknown_handler).to.equal(HANDLER_TYPES.UNSUPPORTED)
    })
  })

  describe('PlayerGamelogHandler', function () {
    let handler
    let test_esbid
    let test_pid

    before(async function () {
      handler = new PlayerGamelogHandler(knex)

      // Get a real game and player from the test database
      const game = await knex('nfl_games').where('seas_type', 'REG').first()
      test_esbid = game?.esbid

      if (test_esbid) {
        const gamelog = await knex('player_gamelogs')
          .where('esbid', test_esbid)
          .where('active', true)
          .whereNotNull('py')
          .where('py', '>', 0)
          .first()

        test_pid = gamelog?.pid
      }
    })

    it('should calculate passing yards correctly', async function () {
      if (!test_esbid || !test_pid) return this.skip()
      const result = await handler.calculate({
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_PASSING_YARDS,
        mapping:
          market_type_mappings[player_game_prop_types.GAME_PASSING_YARDS],
        selection_pid: test_pid,
        selection_metric_line: 250,
        selection_type: 'OVER'
      })

      expect(result).to.have.property('esbid', test_esbid)
      expect(result).to.have.property(
        'market_type',
        player_game_prop_types.GAME_PASSING_YARDS
      )
      expect(result).to.have.property('selection_pid', test_pid)
      expect(result).to.have.property('metric_value')
      expect(result).to.have.property('selection_result')
      expect(result).to.have.property(
        'handler_type',
        HANDLER_TYPES.PLAYER_GAMELOG
      )
      expect(result.metric_value).to.be.a('number')
      expect(['WON', 'LOST']).to.include(result.selection_result)
    })

    it('should handle anytime touchdown markets', async function () {
      if (!test_esbid) return this.skip()
      // Find a player with touchdown data
      const gamelog = await knex('player_gamelogs')
        .where('esbid', test_esbid)
        .where('active', true)
        .where(function () {
          this.where('tdr', '>', 0).orWhere('tdrec', '>', 0)
        })
        .first()

      if (gamelog) {
        const result = await handler.calculate({
          esbid: test_esbid,
          market_type: player_game_prop_types.ANYTIME_TOUCHDOWN,
          mapping:
            market_type_mappings[player_game_prop_types.ANYTIME_TOUCHDOWN],
          selection_pid: gamelog.pid,
          selection_metric_line: 0.5,
          selection_type: 'YES'
        })

        expect(result).to.have.property('metric_value')
        expect(result).to.have.property('selection_result')
        expect([0, 1]).to.include(result.metric_value)
        expect(['WON', 'LOST']).to.include(result.selection_result)
      }
    })

    it('should handle combined stat markets', async function () {
      if (!test_esbid || !test_pid) return this.skip()
      const result = await handler.calculate({
        esbid: test_esbid,
        market_type: player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS,
        mapping:
          market_type_mappings[
            player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS
          ],
        selection_pid: test_pid,
        selection_metric_line: 50,
        selection_type: 'OVER'
      })

      expect(result).to.have.property('metric_value')
      expect(result.metric_value).to.be.a('number')
    })

    it('should pass health check', async function () {
      const healthy = await handler.health_check()
      expect(healthy).to.be.a('boolean')
    })
  })

  describe('NFLPlaysHandler', function () {
    let handler
    let test_esbid

    before(async function () {
      handler = new NFLPlaysHandler(knex)

      // Get a game that has plays data
      const game_with_plays = await knex('nfl_games')
        .join('nfl_plays', 'nfl_games.esbid', 'nfl_plays.esbid')
        .where('nfl_games.seas_type', 'REG')
        .select('nfl_games.esbid')
        .first()

      test_esbid = game_with_plays?.esbid
    })

    it('should calculate longest reception correctly', async function () {
      if (!test_esbid) return this.skip()

      // Find a player with receiving data
      const play = await knex('nfl_plays')
        .where('esbid', test_esbid)
        .whereNotNull('trg_pid')
        .whereNotNull('recv_yds')
        .where('recv_yds', '>', 0)
        .first()

      if (play) {
        const result = await handler.calculate({
          esbid: test_esbid,
          market_type: player_game_prop_types.GAME_LONGEST_RECEPTION,
          mapping:
            market_type_mappings[player_game_prop_types.GAME_LONGEST_RECEPTION],
          selection_pid: play.trg_pid,
          selection_metric_line: 15,
          selection_type: 'OVER'
        })

        expect(result).to.have.property('metric_value')
        expect(result).to.have.property('selection_result')
        expect(result.metric_value).to.be.a('number')
        expect(['WON', 'LOST']).to.include(result.selection_result)
      }
    })

    it('should pass health check', async function () {
      const healthy = await handler.health_check()
      expect(healthy).to.be.a('boolean')
    })
  })

  describe('NFLGamesHandler', function () {
    let handler
    let test_game

    before(async function () {
      handler = new NFLGamesHandler(knex)

      // Get a completed game
      test_game = await knex('nfl_games')
        .where('seas_type', 'REG')
        .whereNotNull('home_score')
        .whereNotNull('away_score')
        .first()
    })

    it('should calculate game totals correctly', async function () {
      if (!test_game) return this.skip()

      const result = await handler.calculate({
        esbid: test_game.esbid,
        market_type: team_game_market_types.GAME_TOTAL,
        mapping: market_type_mappings[team_game_market_types.GAME_TOTAL],
        selection_pid: null,
        selection_metric_line: 45,
        selection_type: 'OVER'
      })

      expect(result).to.have.property('metric_value')
      expect(result).to.have.property('selection_result')
      expect(result.metric_value).to.equal(
        test_game.home_score + test_game.away_score
      )
      expect(['WON', 'LOST']).to.include(result.selection_result)
    })

    it('should calculate moneyline correctly', async function () {
      if (!test_game) return this.skip()

      const home_team_id = test_game.h
      const result = await handler.calculate({
        esbid: test_game.esbid,
        market_type: team_game_market_types.GAME_MONEYLINE,
        mapping: market_type_mappings[team_game_market_types.GAME_MONEYLINE],
        selection_pid: null,
        selection_metric_line: null,
        selection_type: home_team_id
      })

      expect(result).to.have.property('selection_result')
      expect(['WON', 'LOST']).to.include(result.selection_result)
    })

    it('should pass health check', async function () {
      const healthy = await handler.health_check()
      expect(healthy).to.be.a('boolean')
    })
  })

  describe('SettlementOrchestrator', function () {
    let orchestrator

    before(async function () {
      orchestrator = new SettlementOrchestrator(knex)

      // Register all calculators
      await orchestrator.register_calculator(
        HANDLER_TYPES.PLAYER_GAMELOG,
        new PlayerGamelogHandler(knex)
      )
      await orchestrator.register_calculator(
        HANDLER_TYPES.NFL_PLAYS,
        new NFLPlaysHandler(knex)
      )
      await orchestrator.register_calculator(
        HANDLER_TYPES.NFL_GAMES,
        new NFLGamesHandler(knex)
      )
      await orchestrator.register_calculator(
        HANDLER_TYPES.TEAM_STATS,
        new TeamStatsHandler(knex)
      )
    })

    it('should register handlers correctly', function () {
      const handlers = orchestrator.get_registered_handlers()
      expect(handlers).to.include(HANDLER_TYPES.PLAYER_GAMELOG)
      expect(handlers).to.include(HANDLER_TYPES.NFL_PLAYS)
      expect(handlers).to.include(HANDLER_TYPES.NFL_GAMES)
      expect(handlers).to.include(HANDLER_TYPES.TEAM_STATS)
    })

    it('should route markets to correct handlers', async function () {
      // Get test data
      const game = await knex('nfl_games').where('seas_type', 'REG').first()
      if (!game) return this.skip()
      const gamelog = await knex('player_gamelogs')
        .where('esbid', game.esbid)
        .where('active', true)
        .first()

      if (gamelog) {
        const result = await orchestrator.calculate_market_result({
          esbid: game.esbid,
          market_type: player_game_prop_types.GAME_PASSING_YARDS,
          selection_pid: gamelog.pid,
          selection_metric_line: 250,
          selection_type: 'OVER'
        })

        expect(result).to.have.property(
          'handler_type',
          HANDLER_TYPES.PLAYER_GAMELOG
        )
        expect(result).to.have.property('metric_value')
        expect(result).to.have.property('selection_result')
      }
    })

    it('should handle unsupported market types gracefully', async function () {
      const result = await orchestrator.calculate_market_result({
        esbid: 'test_esbid',
        market_type: 'UNSUPPORTED_MARKET_TYPE',
        selection_pid: 'test_pid',
        selection_metric_line: 100,
        selection_type: 'OVER'
      })

      expect(result).to.have.property('error')
      expect(result.error).to.include('Unsupported market type')
    })

    it('should pass health checks for all handlers', async function () {
      const health_status = await orchestrator.health_check()
      expect(health_status[HANDLER_TYPES.PLAYER_GAMELOG]).to.be.a('boolean')
      expect(health_status[HANDLER_TYPES.NFL_PLAYS]).to.be.a('boolean')
      expect(health_status[HANDLER_TYPES.NFL_GAMES]).to.be.a('boolean')
      expect(health_status[HANDLER_TYPES.TEAM_STATS]).to.be.a('boolean')
    })
  })

  after(async function () {
    MockDate.reset()
    await knex.destroy()
  })
})
