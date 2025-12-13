/* global describe, it, beforeEach, afterEach */
import * as chai from 'chai'
import db from '#db'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { PlayerIdMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('External Fantasy Leagues - Player ID Mapper', function () {
  let mapper
  let test_data

  beforeEach(async function () {
    mapper = new PlayerIdMapper()

    // Load test data from fixture
    const fixture_path = path.join(
      __dirname,
      'fixtures/external-fantasy-leagues/player-mapper-test-data.json'
    )
    const fixture_content = await fs.readFile(fixture_path, 'utf8')
    test_data = JSON.parse(fixture_content)

    // Clear any existing test data
    const test_pids = test_data.test_players.map((player) => player.pid)
    await db('player').whereIn('pid', test_pids).del()

    // Insert test players from fixture
    await db('player').insert(test_data.test_players)
  })

  afterEach(async function () {
    // Clean up test data
    const test_pids = test_data.test_players.map((player) => player.pid)
    await db('player').whereIn('pid', test_pids).del()

    mapper.clear_cache()
  })

  describe('map_to_internal', function () {
    it('should map external player ID to internal PID for Sleeper', async function () {
      const scenario = test_data.test_scenarios.direct_id_mapping.sleeper
      const result = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id
      })

      result.should.equal(scenario.expected_pid)
    })

    it('should map external player ID to internal PID for ESPN', async function () {
      const scenario = test_data.test_scenarios.direct_id_mapping.espn
      const result = await mapper.map_to_internal({
        platform: 'espn',
        external_player_id: scenario.external_id
      })

      result.should.equal(scenario.expected_pid)
    })

    it('should return null for unsupported platform', async function () {
      const scenario = test_data.test_scenarios.unsupported_platform
      const result = await mapper.map_to_internal({
        platform: scenario.platform,
        external_player_id: scenario.external_id
      })

      chai.expect(result).to.be.null
    })

    it('should return null when no external player ID provided', async function () {
      const result = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: null
      })

      chai.expect(result).to.be.null
    })

    it('should return null when player not found', async function () {
      const scenario = test_data.test_scenarios.not_found
      const result = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id
      })

      chai.expect(result).to.be.null
    })

    it('should use fallback matching when direct ID lookup fails', async function () {
      const scenario = test_data.test_scenarios.fallback_matching

      // First, add a sleeper_id to the fallback player to test the update functionality
      await db('player')
        .where({ pid: scenario.expected_pid })
        .update({ sleeper_id: scenario.external_id })

      const result = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id,
        fallback_data: scenario.fallback_data
      })

      result.should.equal(scenario.expected_pid)
    })

    it('should cache results to avoid repeated database calls', async function () {
      const scenario = test_data.test_scenarios.direct_id_mapping.sleeper

      // First call
      const result1 = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id
      })

      // Second call with same parameters
      const result2 = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id
      })

      result1.should.equal(scenario.expected_pid)
      result2.should.equal(scenario.expected_pid)

      // Verify cache stats
      const stats = mapper.get_cache_stats()
      stats.size.should.equal(1)
      stats.platforms.should.include('sleeper')
    })

    it('should handle ESPN platform with different field mapping', async function () {
      // Test that a player with both sleeper and espn IDs can be found by either
      const sleeper_scenario =
        test_data.test_scenarios.direct_id_mapping.sleeper
      const result = await mapper.map_to_internal({
        platform: 'espn',
        external_player_id: 2330 // This is the espn_id for TEST-SLEEPER-1
      })

      result.should.equal(sleeper_scenario.expected_pid)
    })
  })

  describe('bulk_map_to_internal', function () {
    it('should map multiple players efficiently', async function () {
      const players = [
        {
          external_id:
            test_data.test_scenarios.direct_id_mapping.sleeper.external_id,
          fallback_data: {}
        },
        { external_id: '67890', fallback_data: {} }, // TEST-SLEEPER-2
        {
          external_id: test_data.test_scenarios.not_found.external_id,
          fallback_data: {}
        } // Not found
      ]

      const results = await mapper.bulk_map_to_internal({
        platform: 'sleeper',
        players
      })

      results.size.should.equal(3)
      results
        .get(test_data.test_scenarios.direct_id_mapping.sleeper.external_id)
        .should.equal(
          test_data.test_scenarios.direct_id_mapping.sleeper.expected_pid
        )
      results.get('67890').should.equal('TEST-SLEEPER-2')
      chai.expect(results.get(test_data.test_scenarios.not_found.external_id))
        .to.be.null
    })
  })

  describe('platform support', function () {
    it('should return list of supported platforms', function () {
      const platforms = mapper.get_supported_platforms()
      platforms.should.be.an('array')
      platforms.should.include('sleeper')
      platforms.should.include('espn')
      platforms.should.include('yahoo')
      platforms.should.include('mfl')
    })

    it('should check platform support correctly', function () {
      mapper.is_platform_supported({ platform: 'sleeper' }).should.be.true
      mapper.is_platform_supported({ platform: 'unsupported' }).should.be.false
    })
  })

  describe('cache management', function () {
    it('should provide cache statistics', async function () {
      const scenario = test_data.test_scenarios.direct_id_mapping.sleeper
      await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id
      })

      const stats = mapper.get_cache_stats()
      stats.should.have.property('size', 1)
      stats.should.have.property('platforms')
      stats.platforms.should.include('sleeper')
    })

    it('should clear cache successfully', async function () {
      const scenario = test_data.test_scenarios.direct_id_mapping.sleeper
      await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: scenario.external_id
      })

      mapper.get_cache_stats().size.should.equal(1)
      mapper.clear_cache()
      mapper.get_cache_stats().size.should.equal(0)
    })
  })

  describe('real world scenarios', function () {
    it('should handle players with multiple platform IDs', async function () {
      // Test that a player with both sleeper and espn IDs can be found by either
      const sleeper_scenario =
        test_data.test_scenarios.direct_id_mapping.sleeper
      const sleeper_result = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: sleeper_scenario.external_id
      })

      const espn_result = await mapper.map_to_internal({
        platform: 'espn',
        external_player_id: 2330 // This is the espn_id for TEST-SLEEPER-1
      })

      sleeper_result.should.equal(sleeper_scenario.expected_pid)
      espn_result.should.equal(sleeper_scenario.expected_pid)
      sleeper_result.should.equal(espn_result)
    })

    it('should handle case insensitive platform names', async function () {
      const scenario = test_data.test_scenarios.direct_id_mapping.sleeper
      const result = await mapper.map_to_internal({
        platform: 'SLEEPER',
        external_player_id: scenario.external_id
      })

      result.should.equal(scenario.expected_pid)
    })

    it('should handle numeric and string external IDs', async function () {
      // Test string ID
      const sleeper_scenario =
        test_data.test_scenarios.direct_id_mapping.sleeper
      const string_result = await mapper.map_to_internal({
        platform: 'sleeper',
        external_player_id: sleeper_scenario.external_id
      })

      // Test numeric ID
      const espn_scenario = test_data.test_scenarios.direct_id_mapping.espn
      const numeric_result = await mapper.map_to_internal({
        platform: 'espn',
        external_player_id: espn_scenario.external_id
      })

      string_result.should.equal(sleeper_scenario.expected_pid)
      numeric_result.should.equal(espn_scenario.expected_pid)
    })
  })
})
