/* global describe, it, before */
import * as chai from 'chai'

import {
  load_expected_output,
  load_platform_response
} from './utils/fixture-loader.mjs'
import { LeagueConfigMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - League Config Mapper', function () {
  let sleeper_expected
  let espn_expected
  let sleeper_platform_data
  let mapper

  before(async function () {
    // Load fixture data once for all tests
    sleeper_expected = await load_expected_output('sleeper-config')
    espn_expected = await load_expected_output('espn-config')
    sleeper_platform_data = await load_platform_response(
      'sleeper',
      'league-config'
    )

    mapper = new LeagueConfigMapper()
  })

  describe('fixture data validation', function () {
    it('should load Sleeper expected outputs fixture correctly', function () {
      sleeper_expected.should.have.property('mapper_type', 'LeagueConfigMapper')
      sleeper_expected.should.have.property('platform', 'sleeper')
      sleeper_expected.should.have.property('test_scenarios')
      sleeper_expected.test_scenarios.should.be.an('array')
    })

    it('should load ESPN expected outputs fixture correctly', function () {
      espn_expected.should.have.property('mapper_type', 'LeagueConfigMapper')
      espn_expected.should.have.property('platform', 'espn')
      espn_expected.should.have.property('test_scenarios')
      espn_expected.test_scenarios.should.be.an('array')
    })

    it('should load Sleeper platform response fixture correctly', function () {
      sleeper_platform_data.should.have.property('platform', 'sleeper')
      sleeper_platform_data.should.have.property(
        'response_type',
        'league-config'
      )
      sleeper_platform_data.should.have.property('data')
      sleeper_platform_data.data.should.have.property('league')
    })
  })

  describe('map_league_config', function () {
    it('should map Sleeper league configuration correctly', function () {
      const scenario = sleeper_expected.test_scenarios.find(
        (s) => s.scenario_name === 'standard_sleeper_league'
      )
      scenario.should.not.be.undefined

      const result = mapper.map_league_config(scenario.input)

      result.should.have.property('league_format')
      result.should.have.property('scoring_format')
      result.should.have.property('league_format_hash')
      result.should.have.property('scoring_format_hash')

      // Verify league format mapping
      const expected_league_format = scenario.expected_output.league_format
      Object.keys(expected_league_format).forEach((key) => {
        result.league_format.should.have.property(
          key,
          expected_league_format[key]
        )
      })

      // Verify scoring format mapping
      const expected_scoring_format = scenario.expected_output.scoring_format
      Object.keys(expected_scoring_format).forEach((key) => {
        result.scoring_format.should.have.property(
          key,
          expected_scoring_format[key]
        )
      })
    })

    it('should map ESPN league configuration correctly', function () {
      const scenario = espn_expected.test_scenarios.find(
        (s) => s.scenario_name === 'standard_espn_league'
      )
      scenario.should.not.be.undefined

      const result = mapper.map_league_config(scenario.input)

      result.should.have.property('league_format_hash')
      result.should.have.property('scoring_format_hash')

      // Verify league format mapping
      const expected_league_format = scenario.expected_output.league_format
      Object.keys(expected_league_format).forEach((key) => {
        result.league_format.should.have.property(
          key,
          expected_league_format[key]
        )
      })

      // Verify scoring format mapping
      const expected_scoring_format = scenario.expected_output.scoring_format
      Object.keys(expected_scoring_format).forEach((key) => {
        result.scoring_format.should.have.property(
          key,
          expected_scoring_format[key]
        )
      })
    })

    it('should handle default values for missing configuration', function () {
      const scenario = sleeper_expected.test_scenarios.find(
        (s) => s.scenario_name === 'minimal_sleeper_config'
      )
      scenario.should.not.be.undefined

      const result = mapper.map_league_config(scenario.input)

      result.should.have.property('league_format_hash')
      result.should.have.property('scoring_format_hash')

      // Verify default values from fixture
      const expected_league_format = scenario.expected_output.league_format
      Object.keys(expected_league_format).forEach((key) => {
        result.league_format.should.have.property(
          key,
          expected_league_format[key]
        )
      })

      const expected_scoring_format = scenario.expected_output.scoring_format
      Object.keys(expected_scoring_format).forEach((key) => {
        result.scoring_format.should.have.property(
          key,
          expected_scoring_format[key]
        )
      })
    })

    it('should throw error for unsupported platform', function () {
      const error_scenario = espn_expected.error_scenarios.find(
        (s) => s.scenario_name === 'unsupported_platform'
      )
      error_scenario.should.not.be.undefined

      chai
        .expect(() => {
          mapper.map_league_config(error_scenario.input)
        })
        .to.throw(error_scenario.expected_error)
    })

    it('should map real Sleeper platform response data correctly', function () {
      const league_data = sleeper_platform_data.data.league

      const result = mapper.map_league_config({
        platform: 'sleeper',
        league_config: {
          num_teams: league_data.total_rosters
        },
        scoring_config: league_data.scoring_settings,
        roster_config: league_data.roster_positions
      })

      result.should.have.property('league_format')
      result.should.have.property('scoring_format')
      result.should.have.property('league_format_hash')
      result.should.have.property('scoring_format_hash')

      // Verify specific mappings from real data
      result.league_format.should.have.property('num_teams', 12)
      result.league_format.should.have.property('sqb', 1)
      result.league_format.should.have.property('srb', 2)
      result.league_format.should.have.property('swr', 3)
      result.league_format.should.have.property('ste', 1)
      result.league_format.should.have.property('srbwr', 2) // FLEX (2 in real fixture)
      result.league_format.should.have.property('sdst', 0) // No DST in superflex league
      result.league_format.should.have.property('sk', 0) // No K in superflex league
      result.league_format.should.have.property('bench', 15) // 15 BN in real fixture

      // Verify scoring mappings
      result.scoring_format.should.have.property('py', 4) // 0.04 -> 4
      result.scoring_format.should.have.property('tdp', 6)
      result.scoring_format.should.have.property('ints', -2)
      result.scoring_format.should.have.property('ry', 10) // 0.1 -> 10
      result.scoring_format.should.have.property('tdr', 6)
      result.scoring_format.should.have.property('rec', 1) // PPR
      result.scoring_format.should.have.property('recy', 10)
      result.scoring_format.should.have.property('tdrec', 6)
    })
  })

  describe('map_scoring_config', function () {
    it('should convert decimal point values correctly', function () {
      const scoring_config = {
        pass_yd: 0.04, // Should become 4
        rush_yd: 0.1, // Should become 10
        rec_yd: 0.1, // Should become 10
        pass_td: 6 // Should stay 6
      }

      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config
      })

      result.should.have.property('py', 4)
      result.should.have.property('ry', 10)
      result.should.have.property('recy', 10)
      result.should.have.property('tdp', 6)
    })

    it('should handle platform-specific special rules', function () {
      const sleeper_config = {
        exclude_qb_kneels: true,
        pass_yd: 0.04
      }

      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: sleeper_config
      })

      result.should.have.property('exclude_qb_kneels', true)
    })
  })

  describe('validate_mapped_config', function () {
    it('should validate correct configuration', function () {
      const scenario = sleeper_expected.validation_scenarios.find(
        (s) => s.scenario_name === 'valid_complete_config'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_mapped_config(scenario.input)
      result.should.equal(scenario.expected_result)
    })

    it('should reject configuration with missing hash', function () {
      const scenario = sleeper_expected.validation_scenarios.find(
        (s) => s.scenario_name === 'missing_league_hash'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_mapped_config(scenario.input)
      result.should.equal(scenario.expected_result)
    })

    it('should reject configuration with no starting positions', function () {
      const scenario = sleeper_expected.validation_scenarios.find(
        (s) => s.scenario_name === 'no_starting_positions'
      )
      scenario.should.not.be.undefined

      const result = mapper.validate_mapped_config(scenario.input)
      result.should.equal(scenario.expected_result)
    })
  })
})
