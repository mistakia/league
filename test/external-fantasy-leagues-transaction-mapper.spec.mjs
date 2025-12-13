/* global describe, it, before */
import * as chai from 'chai'

import {
  load_expected_output,
  load_platform_response
} from './utils/fixture-loader.mjs'
import { TransactionMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'
import { transaction_types } from '#constants'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - Transaction Mapper', function () {
  let expected_outputs
  let sleeper_transactions
  let espn_transactions
  let mapper

  before(async function () {
    // Load fixture data once for all tests
    expected_outputs = await load_expected_output('transaction-mappings')
    sleeper_transactions = await load_platform_response(
      'sleeper',
      'transactions'
    )
    espn_transactions = await load_platform_response('espn', 'transactions')

    mapper = new TransactionMapper()
  })

  describe('fixture data validation', function () {
    it('should load expected outputs fixture correctly', function () {
      expected_outputs.should.have.property('mapper_type', 'TransactionMapper')
      expected_outputs.should.have.property('test_scenarios')
      expected_outputs.test_scenarios.should.be.an('array')
    })

    it('should load Sleeper platform response fixture correctly', function () {
      sleeper_transactions.should.have.property('platform', 'sleeper')
      sleeper_transactions.should.have.property('response_type', 'transactions')
      sleeper_transactions.should.have.property('data')
      sleeper_transactions.data.should.have.property('transactions')
      sleeper_transactions.data.transactions.should.be.an('array')
    })

    it('should load ESPN platform response fixture correctly', function () {
      espn_transactions.should.have.property('platform', 'espn')
      espn_transactions.should.have.property('response_type', 'transactions')
      espn_transactions.should.have.property('data')
      espn_transactions.data.should.have.property('transactions')
      // ESPN transactions fixture has a nested structure, not a flat array
      espn_transactions.data.transactions.should.be.an('object')
    })
  })

  describe('map_transaction', function () {
    it('should map Sleeper transaction correctly', function () {
      const scenario = expected_outputs.test_scenarios.find(
        (s) => s.scenario_name === 'sleeper_add_transaction'
      )
      scenario.should.not.be.undefined

      // Convert context maps from objects to Maps for the test
      const context = {
        ...scenario.input.context,
        player_mappings: new Map(
          Object.entries(scenario.input.context.player_mappings)
        ),
        team_mappings: new Map(
          Object.entries(scenario.input.context.team_mappings)
        ),
        user_mappings: new Map(
          Object.entries(scenario.input.context.user_mappings)
        )
      }

      const result = mapper.map_transaction({
        platform: scenario.input.platform,
        external_transaction: scenario.input.external_transaction,
        context
      })

      // Verify all expected properties
      const expected = scenario.expected_output
      Object.keys(expected).forEach((key) => {
        result.should.have.property(key, expected[key])
      })
    })

    it('should map ESPN transaction correctly', function () {
      const scenario = expected_outputs.test_scenarios.find(
        (s) => s.scenario_name === 'espn_trade_transaction'
      )
      scenario.should.not.be.undefined

      const context = {
        ...scenario.input.context,
        player_mappings: new Map(
          Object.entries(scenario.input.context.player_mappings)
        ),
        team_mappings: new Map(
          Object.entries(scenario.input.context.team_mappings)
        )
      }

      const result = mapper.map_transaction({
        platform: scenario.input.platform,
        external_transaction: scenario.input.external_transaction,
        context
      })

      const expected = scenario.expected_output
      Object.keys(expected).forEach((key) => {
        result.should.have.property(key, expected[key])
      })
    })

    it('should return null for unsupported platform', function () {
      const scenario = expected_outputs.null_scenarios.find(
        (s) => s.scenario_name === 'unsupported_platform'
      )
      scenario.should.not.be.undefined

      const result = mapper.map_transaction(scenario.input)
      chai.expect(result).to.equal(scenario.expected_output)
    })

    it('should return null for unsupported transaction type', function () {
      const scenario = expected_outputs.null_scenarios.find(
        (s) => s.scenario_name === 'unsupported_transaction_type'
      )
      scenario.should.not.be.undefined

      const result = mapper.map_transaction(scenario.input)
      chai.expect(result).to.equal(scenario.expected_output)
    })

    it('should skip lineup changes for ESPN', function () {
      const scenario = expected_outputs.null_scenarios.find(
        (s) => s.scenario_name === 'espn_lineup_change'
      )
      scenario.should.not.be.undefined

      const result = mapper.map_transaction(scenario.input)
      chai.expect(result).to.equal(scenario.expected_output)
    })

    it('should handle missing player mapping gracefully', function () {
      const scenario = expected_outputs.test_scenarios.find(
        (s) => s.scenario_name === 'unmapped_player'
      )
      scenario.should.not.be.undefined

      const context = {
        ...scenario.input.context,
        player_mappings: new Map(
          Object.entries(scenario.input.context.player_mappings)
        ),
        team_mappings: new Map(
          Object.entries(scenario.input.context.team_mappings)
        )
      }

      const result = mapper.map_transaction({
        platform: scenario.input.platform,
        external_transaction: scenario.input.external_transaction,
        context
      })

      const expected = scenario.expected_output
      Object.keys(expected).forEach((key) => {
        result.should.have.property(key, expected[key])
      })
    })

    it('should recognize Sleeper transaction types from real platform data', function () {
      // Note: Real Sleeper transactions use adds/drops objects format:
      // { "adds": { "player_id": roster_id }, "drops": { "player_id": roster_id } }
      // The current mapper expects simplified format with player_id/roster_id fields.
      // This test verifies transaction type extraction works with real data structure.
      const real_transaction = sleeper_transactions.data.transactions[0]

      // Verify fixture has expected Sleeper waiver structure
      real_transaction.should.have.property('type', 'waiver')
      real_transaction.should.have.property('adds')
      real_transaction.should.have.property('created')

      // Test transaction type extraction
      const transaction_type =
        mapper.transaction_mappings.sleeper[real_transaction.type]
      transaction_type.should.equal(transaction_types.ROSTER_ADD)

      // Test timestamp extraction
      const timestamp = mapper.extract_timestamp(real_transaction)
      timestamp.should.be.a('number')
      // Should convert milliseconds to seconds
      timestamp.should.be.below(real_transaction.created)
    })

    it('should convert timestamp formats correctly', function () {
      const scenarios = expected_outputs.timestamp_conversion_scenarios

      scenarios.forEach((scenario) => {
        const result = mapper.extract_timestamp({ timestamp: scenario.input })
        result.should.equal(scenario.expected_output)
      })
    })
  })

  describe('bulk_map_transactions', function () {
    it('should map multiple transactions efficiently', function () {
      const scenario = expected_outputs.bulk_scenarios.find(
        (s) => s.scenario_name === 'multiple_sleeper_transactions'
      )
      scenario.should.not.be.undefined

      const context = {
        ...scenario.input.context,
        player_mappings: new Map(
          Object.entries(scenario.input.context.player_mappings)
        ),
        team_mappings: new Map(
          Object.entries(scenario.input.context.team_mappings)
        )
      }

      const results = mapper.bulk_map_transactions({
        platform: scenario.input.platform,
        external_transactions: scenario.input.external_transactions,
        context
      })

      results.should.have.length(scenario.expected_output_count)

      // Verify transaction types match expected
      scenario.expected_types.forEach((expectedType, index) => {
        results[index].should.have.property('type', expectedType)
      })
    })
  })

  describe('validate_transaction', function () {
    it('should validate correct transaction', function () {
      const scenario = expected_outputs.validation_scenarios.find(
        (s) => s.scenario_name === 'valid_transaction'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_transaction(scenario.input)
      result.should.equal(scenario.expected_result)
    })

    it('should reject transaction with missing required fields', function () {
      const scenario = expected_outputs.validation_scenarios.find(
        (s) => s.scenario_name === 'missing_fields'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_transaction(scenario.input)
      result.should.equal(scenario.expected_result)
    })

    it('should reject transaction with invalid timestamp', function () {
      const scenario = expected_outputs.validation_scenarios.find(
        (s) => s.scenario_name === 'invalid_timestamp'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_transaction(scenario.input)
      result.should.equal(scenario.expected_result)
    })

    it('should reject transaction with invalid type', function () {
      const scenario = expected_outputs.validation_scenarios.find(
        (s) => s.scenario_name === 'invalid_type'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_transaction(scenario.input)
      result.should.equal(scenario.expected_result)
    })
  })

  describe('platform support', function () {
    it('should return list of supported platforms', function () {
      const scenario = expected_outputs.platform_support_scenarios.find(
        (s) => s.scenario_name === 'supported_platforms'
      )
      scenario.should.not.be.undefined

      const platforms = mapper.get_supported_platforms()
      platforms.should.be.an('array')

      scenario.expected_platforms.forEach((platform) => {
        platforms.should.include(platform)
      })
    })

    it('should check platform support correctly', function () {
      const scenario = expected_outputs.platform_support_scenarios.find(
        (s) => s.scenario_name === 'platform_check'
      )
      scenario.should.not.be.undefined

      scenario.test_cases.forEach((testCase) => {
        const result = mapper.is_platform_supported({
          platform: testCase.platform
        })
        result.should.equal(testCase.expected)
      })
    })
  })

  describe('extract_transaction_type', function () {
    it('should extract type from different field names', function () {
      const scenario = expected_outputs.transaction_type_extraction.find(
        (s) => s.scenario_name === 'different_field_names'
      )
      scenario.should.not.be.undefined

      scenario.test_cases.forEach((testCase) => {
        const result = mapper.extract_transaction_type({
          platform: testCase.platform,
          external_transaction: testCase.transaction
        })
        result.should.equal(testCase.expected)
      })
    })
  })
})
