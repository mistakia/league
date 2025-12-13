/* global describe, it, beforeEach */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'

import SyncOrchestrator from '#libs-server/external-fantasy-leagues/sync/sync-orchestrator.mjs'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - Sync Orchestrator', function () {
  let orchestrator
  let test_fixtures

  beforeEach(function () {
    orchestrator = new SyncOrchestrator()

    // Load test fixtures
    const fixtures_path = path.join(
      process.cwd(),
      'test',
      'fixtures',
      'external-fantasy-leagues'
    )
    test_fixtures = {
      player_mapper_data: JSON.parse(
        fs.readFileSync(
          path.join(fixtures_path, 'player-mapper-test-data.json'),
          'utf8'
        )
      ),
      sleeper_config: JSON.parse(
        fs.readFileSync(
          path.join(
            fixtures_path,
            'platform-responses',
            'sleeper',
            'league-config.json'
          ),
          'utf8'
        )
      )
    }
  })

  describe('initialize_adapter', function () {
    it('should initialize platform adapter successfully', function () {
      const adapter = orchestrator.initialize_adapter({
        platform_name: 'sleeper',
        adapter_config: { timeout: 30000 }
      })

      adapter.should.be.an('object')
      adapter.should.have.property('get_platform')
      adapter.get_platform().should.equal('sleeper')
    })

    it('should return cached adapter on subsequent calls', function () {
      const adapter1 = orchestrator.initialize_adapter({
        platform_name: 'sleeper'
      })
      const adapter2 = orchestrator.initialize_adapter({
        platform_name: 'sleeper'
      })

      adapter1.should.equal(adapter2) // Same instance
    })

    it('should throw error for unsupported platform', function () {
      chai
        .expect(() => {
          orchestrator.initialize_adapter({ platform_name: 'unsupported' })
        })
        .to.throw('Unsupported platform: unsupported')
    })
  })

  describe('validate_sync_params', function () {
    it('should validate correct parameters', function () {
      const params = {
        platform_name: 'sleeper',
        external_league_id: '123456',
        internal_league_id: 'abc-123'
      }

      const result = orchestrator.sync_utils.validate_sync_params(params)
      result.should.have.property('valid', true)
      result.should.have.property('errors').that.is.empty
    })

    it('should reject missing platform', function () {
      const params = {
        external_league_id: '123456',
        internal_league_id: 'abc-123'
      }

      const result = orchestrator.sync_utils.validate_sync_params(params)
      result.should.have.property('valid', false)
      result.should.have
        .property('errors')
        .that.includes('Platform name is required')
    })

    it('should reject missing league IDs', function () {
      const params = {
        platform_name: 'sleeper'
      }

      const result = orchestrator.sync_utils.validate_sync_params(params)
      result.should.have.property('valid', false)
      result.errors.should.include('External league ID is required')
      result.errors.should.include('Internal league ID is required')
    })
  })

  describe('platform support', function () {
    it('should return list of supported platforms', function () {
      // Test that we can initialize adapters for all supported platforms
      const supported_platforms = [
        'sleeper',
        'espn',
        'yahoo',
        'mfl',
        'cbs',
        'ffpc',
        'nffc',
        'fantrax',
        'fleaflicker',
        'nfl',
        'rtsports'
      ]

      supported_platforms.forEach((platform) => {
        const adapter = orchestrator.initialize_adapter({
          platform_name: platform
        })
        adapter.should.be.an('object')
        adapter.should.have.property('get_platform')
      })
    })

    it('should check platform support correctly', function () {
      // Test with actual adapter initialization
      const sleeper_adapter = orchestrator.initialize_adapter({
        platform_name: 'sleeper'
      })
      sleeper_adapter.should.be.an('object')

      // Test unsupported platform
      chai
        .expect(() => {
          orchestrator.initialize_adapter({ platform_name: 'unsupported' })
        })
        .to.throw('Unsupported platform: unsupported')
    })
  })

  describe('sync_stats creation', function () {
    it('should create fresh sync statistics for each operation', function () {
      // Create sync_stats via private method
      const sync_stats = orchestrator._create_sync_stats()

      sync_stats.should.deep.equal({
        players_mapped: 0,
        transactions_imported: 0,
        rosters_updated: 0,
        errors: []
      })

      // Modify the stats
      sync_stats.players_mapped = 10
      sync_stats.transactions_imported = 5
      sync_stats.errors.push('test error')

      // Create another - should be fresh (not affected by previous)
      const sync_stats_2 = orchestrator._create_sync_stats()
      sync_stats_2.should.deep.equal({
        players_mapped: 0,
        transactions_imported: 0,
        rosters_updated: 0,
        errors: []
      })
    })

    it('should reset sync statistics via sync_utils', function () {
      const sync_stats = orchestrator._create_sync_stats()

      // Modify stats
      sync_stats.players_mapped = 10
      sync_stats.transactions_imported = 5
      sync_stats.errors.push('test error')

      orchestrator.sync_utils.reset_sync_stats(sync_stats)

      sync_stats.should.deep.equal({
        players_mapped: 0,
        transactions_imported: 0,
        rosters_updated: 0,
        errors: []
      })
    })
  })

  describe('sync context creation', function () {
    it('should create sync context with correct defaults', function () {
      const context = orchestrator.sync_utils.create_sync_context({
        platform_name: 'sleeper',
        external_league_id: '123456',
        internal_league_id: 'abc-123'
      })

      context.should.have.property('platform', 'sleeper')
      context.should.have.property('external_league_id', '123456')
      context.should.have.property('internal_league_id', 'abc-123')
      context.should.have.property('year').that.is.a('number')
      context.should.have.property('week', 1)
      context.should.have.property('team_mappings').that.is.instanceof(Map)
      context.should.have.property('player_mappings').that.is.instanceof(Map)
    })

    it('should create sync context with custom year and week', function () {
      const context = orchestrator.sync_utils.create_sync_context({
        platform_name: 'espn',
        external_league_id: '789',
        internal_league_id: 'def-456',
        year: 2024,
        week: 5
      })

      context.should.have.property('year', 2024)
      context.should.have.property('week', 5)
    })
  })

  describe('error handling utilities', function () {
    it('should create standardized error objects', function () {
      const error = orchestrator.sync_utils.create_sync_error({
        error_type: 'test_error',
        error_message: 'Test error message',
        step: 'test_step'
      })

      error.should.have.property('step', 'test_step')
      error.should.have.property('type', 'test_error')
      error.should.have.property('message', 'Test error message')
      error.should.have.property('timestamp').that.is.a('string')
      error.should.have.property('context').that.is.an('object')
    })

    it('should create standardized output with errors', function () {
      const output = orchestrator.sync_utils.create_standardized_output({
        platform_name: 'sleeper',
        success: false,
        errors: [
          {
            type: 'validation_error',
            message: 'Invalid parameters'
          }
        ]
      })

      output.should.have.property('success', false)
      output.should.have.property('platform', 'sleeper')
      output.should.have.property('errors').that.is.an('array')
      output.errors[0].should.have.property('type', 'validation_error')
      output.errors[0].should.have.property('message', 'Invalid parameters')
    })
  })

  describe('integration test preparation', function () {
    it('should have all required sync modules initialized', function () {
      orchestrator.should.have.property('config_sync')
      orchestrator.should.have.property('team_sync')
      orchestrator.should.have.property('roster_sync')
      orchestrator.should.have.property('transaction_sync')
      orchestrator.should.have.property('progress_reporter')
      orchestrator.should.have.property('sync_utils')

      // Check that sync modules have expected methods
      orchestrator.config_sync.should.have.property('sync_league_config')
      orchestrator.team_sync.should.have.property('sync_teams')
      orchestrator.roster_sync.should.have.property('sync_rosters')
      orchestrator.transaction_sync.should.have.property('sync_transactions')
    })

    it('should create per-operation sync stats (no instance-level state)', function () {
      // Verify sync_stats is NOT an instance property (prevents concurrent sync interference)
      orchestrator.should.not.have.property('sync_stats')

      // Verify _create_sync_stats method exists for per-operation stats creation
      orchestrator.should.have
        .property('_create_sync_stats')
        .that.is.a('function')

      // Verify created stats have correct structure
      const sync_stats = orchestrator._create_sync_stats()
      sync_stats.should.have.property('players_mapped', 0)
      sync_stats.should.have.property('transactions_imported', 0)
      sync_stats.should.have.property('rosters_updated', 0)
      sync_stats.should.have.property('errors').that.is.an('array')
    })

    it('should have adapter cache initialized', function () {
      orchestrator.should.have.property('adapters')
      orchestrator.adapters.should.be.instanceof(Map)
    })
  })

  describe('fixture data validation', function () {
    it('should have valid test fixture data structure', function () {
      test_fixtures.should.have.property('player_mapper_data')
      test_fixtures.should.have.property('sleeper_config')

      test_fixtures.player_mapper_data.should.have
        .property('test_players')
        .that.is.an('array')
      test_fixtures.player_mapper_data.should.have
        .property('test_scenarios')
        .that.is.an('object')

      test_fixtures.sleeper_config.should.have.property('platform', 'sleeper')
      test_fixtures.sleeper_config.should.have
        .property('data')
        .that.is.an('object')
    })

    it('should have valid sleeper league config fixture', function () {
      const league_data = test_fixtures.sleeper_config.data.league
      league_data.should.have.property('name')
      league_data.should.have.property('settings').that.is.an('object')
      league_data.should.have.property('scoring_settings').that.is.an('object')
    })
  })

  // Note: Full sync_league integration tests would require database setup
  // and actual platform API calls. These tests focus on unit-level
  // functionality. Integration tests should be added separately.
})
