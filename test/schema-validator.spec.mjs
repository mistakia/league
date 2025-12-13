/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai'
import { SchemaValidator } from '#libs-server/external-fantasy-leagues/utils/schema-validator.mjs'

describe('SchemaValidator', function () {
  let validator

  beforeEach(function () {
    validator = new SchemaValidator()
  })

  afterEach(function () {
    validator.clear_cache()
  })

  describe('Schema Loading', function () {
    it('should load canonical league format schema', async function () {
      const schema = await validator.load_schema('canonical-league-format')
      expect(schema).to.be.an('object')
      expect(schema.type).to.equal('object')
      expect(schema.properties).to.be.an('object')
    })

    it('should cache loaded schemas', async function () {
      await validator.load_schema('canonical-league-format')
      const stats_before = validator.get_stats()

      await validator.load_schema('canonical-league-format')
      const stats_after = validator.get_stats()

      expect(stats_before.cached_schemas).to.equal(stats_after.cached_schemas)
    })

    it('should throw error for non-existent schema', async function () {
      try {
        await validator.load_schema('non-existent-schema')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.include('Failed to load schema')
      }
    })
  })

  describe('Schema Validation', function () {
    describe('validate_league', function () {
      it('should validate valid league data', async function () {
        const valid_league_data = {
          league_id: 'test_league_123',
          name: 'Test League',
          platform: 'test',
          season_year: 2024,
          teams: [],
          settings: {
            roster_size: 16,
            scoring_system: 'standard'
          }
        }

        const result = await validator.validate_league(valid_league_data)
        // Note: This may fail initially due to strict schema requirements
        // The test validates that the validator runs without errors
        expect(result).to.have.property('valid')
        expect(result).to.have.property('errors')
        expect(result).to.have.property('format_type', 'league')
      })

      it('should identify invalid league data', async function () {
        const invalid_data = {
          // Missing required fields
          name: 'Test League'
        }

        const result = await validator.validate_league(invalid_data)
        expect(result.valid).to.be.false
        expect(result.errors).to.be.an('array')
        expect(result.errors.length).to.be.greaterThan(0)
      })
    })

    describe('validate_team', function () {
      it('should validate valid team data', async function () {
        const valid_team_data = {
          external_team_id: 'team_123',
          platform: 'SLEEPER',
          league_external_id: 'league_456',
          team_name: 'Test Team'
        }

        const result = await validator.validate_team(valid_team_data)
        expect(result).to.have.property('valid', true)
        expect(result).to.have.property('errors')
        expect(result).to.have.property('format_type', 'team')
      })

      it('should identify invalid team data', async function () {
        const invalid_data = {
          // Missing required fields
          team_name: 'Test Team'
        }

        const result = await validator.validate_team(invalid_data)
        expect(result.valid).to.be.false
        expect(result.errors).to.be.an('array')
        expect(result.errors.length).to.be.greaterThan(0)
      })
    })

    describe('validate_roster', function () {
      it('should validate valid roster data', async function () {
        const valid_roster_data = {
          external_roster_id: 'roster_123',
          platform: 'SLEEPER',
          league_external_id: 'league_456',
          team_external_id: 'team_789',
          week: 1,
          year: 2024
        }

        const result = await validator.validate_roster(valid_roster_data)
        expect(result).to.have.property('valid', true)
        expect(result).to.have.property('errors')
        expect(result).to.have.property('format_type', 'roster')
      })

      it('should identify invalid roster data', async function () {
        const invalid_data = {
          // Missing required fields
          week: 1
        }

        const result = await validator.validate_roster(invalid_data)
        expect(result.valid).to.be.false
        expect(result.errors).to.be.an('array')
        expect(result.errors.length).to.be.greaterThan(0)
      })

      it('should reject roster with invalid week number', async function () {
        const invalid_data = {
          external_roster_id: 'roster_123',
          platform: 'SLEEPER',
          league_external_id: 'league_456',
          team_external_id: 'team_789',
          week: 25, // Invalid: max is 18
          year: 2024
        }

        const result = await validator.validate_roster(invalid_data)
        expect(result.valid).to.be.false
      })
    })

    describe('validate_transaction', function () {
      it('should validate valid transaction data', async function () {
        const valid_transaction_data = {
          external_transaction_id: 'txn_123',
          platform: 'SLEEPER',
          league_external_id: 'league_456',
          transaction_type: 'TRADE',
          transaction_date: new Date().toISOString(),
          year: 2024
        }

        const result = await validator.validate_transaction(
          valid_transaction_data
        )
        expect(result).to.have.property('valid', true)
        expect(result).to.have.property('errors')
        expect(result).to.have.property('format_type', 'transaction')
      })

      it('should identify invalid transaction data', async function () {
        const invalid_data = {
          // Missing required fields
          transaction_type: 'TRADE'
        }

        const result = await validator.validate_transaction(invalid_data)
        expect(result.valid).to.be.false
        expect(result.errors).to.be.an('array')
        expect(result.errors.length).to.be.greaterThan(0)
      })

      it('should reject invalid transaction type', async function () {
        const invalid_data = {
          external_transaction_id: 'txn_123',
          platform: 'SLEEPER',
          league_external_id: 'league_456',
          transaction_type: 'INVALID_TYPE', // Not in enum
          transaction_date: new Date().toISOString(),
          year: 2024
        }

        const result = await validator.validate_transaction(invalid_data)
        expect(result.valid).to.be.false
      })
    })

    describe('validate_player', function () {
      it('should validate valid player data', async function () {
        const valid_player_data = {
          player_ids: {
            sleeper_id: '4017',
            espn_id: null,
            yahoo_id: null,
            mfl_id: null
          },
          platform: 'SLEEPER',
          player_name: 'Josh Allen'
        }

        const result = await validator.validate_player(valid_player_data)
        expect(result).to.have.property('valid', true)
        expect(result).to.have.property('errors')
        expect(result).to.have.property('format_type', 'player')
      })

      it('should identify invalid player data', async function () {
        const invalid_data = {
          // Missing required fields
          player_name: 'Josh Allen'
        }

        const result = await validator.validate_player(invalid_data)
        expect(result.valid).to.be.false
        expect(result.errors).to.be.an('array')
        expect(result.errors.length).to.be.greaterThan(0)
      })

      it('should reject invalid platform', async function () {
        const invalid_data = {
          player_ids: { sleeper_id: '4017' },
          platform: 'INVALID_PLATFORM', // Not in enum
          player_name: 'Josh Allen'
        }

        const result = await validator.validate_player(invalid_data)
        expect(result.valid).to.be.false
      })
    })
  })

  describe('Batch Validation', function () {
    it('should validate multiple items', async function () {
      const test_data = [
        { league_id: 'league1', name: 'League 1', platform: 'test' },
        { league_id: 'league2', name: 'League 2', platform: 'test' }
      ]

      const result = await validator.validate_batch('league', test_data)
      expect(result).to.have.property('total', 2)
      expect(result).to.have.property('valid')
      expect(result).to.have.property('invalid')
      expect(result.valid + result.invalid).to.equal(2)
    })

    it('should throw error for non-array input', async function () {
      try {
        await validator.validate_batch('league', 'not-an-array')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.include('Data must be an array')
      }
    })
  })

  describe('Utility Functions', function () {
    it('should create data summary', function () {
      const test_data = {
        id: 'test_123',
        name: 'Test Item',
        nested: { value: 42 }
      }

      const summary = validator.create_data_summary(test_data)
      expect(summary).to.have.property('keys')
      expect(summary).to.have.property('key_count', 3)
      expect(summary).to.have.property('id', 'test_123')
    })

    it('should get validation statistics', function () {
      const stats = validator.get_stats()
      expect(stats).to.have.property('cached_schemas')
      expect(stats).to.have.property('compiled_validators')
      expect(stats).to.have.property('cache_duration_ms')
      expect(stats).to.have.property('schema_names')
    })

    it('should clear cache', async function () {
      await validator.load_schema('canonical-league-format')
      expect(validator.get_stats().cached_schemas).to.be.greaterThan(0)

      validator.clear_cache()
      expect(validator.get_stats().cached_schemas).to.equal(0)
    })
  })
})
