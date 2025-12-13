/**
 * Fixture loader utility for external fantasy leagues testing
 *
 * Provides utilities for loading and managing test fixtures
 * with caching and error handling capabilities.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Fixture loader class for comprehensive fixture management
 */
export class FixtureLoader {
  constructor() {
    this.cache = new Map()
    this.fixtures_root = path.join(
      __dirname,
      '..',
      'fixtures',
      'external-fantasy-leagues'
    )
  }

  /**
   * Load platform response fixture
   * @param {string} platform - Platform name (sleeper, espn, etc.)
   * @param {string} data_type - Data type (league, players, etc.)
   * @param {object} options - Loading options
   * @returns {Promise<object>} Platform response data
   */
  async load_platform_response(platform, data_type, options = {}) {
    const { use_cache = true } = options
    const cache_key = `platform:${platform}:${data_type}`

    // Check cache first
    if (use_cache && this.cache.has(cache_key)) {
      return this.cache.get(cache_key)
    }

    try {
      const file_path = path.join(
        this.fixtures_root,
        'platform-responses',
        platform,
        `${data_type}.json`
      )

      const content = await fs.readFile(file_path, 'utf8')
      const fixture = JSON.parse(content)

      // Cache the result
      if (use_cache) {
        this.cache.set(cache_key, fixture)
      }

      return fixture
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Platform response fixture not found: ${platform}/${data_type}`
        )
      }
      throw err
    }
  }

  /**
   * Load expected output fixture
   * @param {string} test_scenario - Test scenario name
   * @param {object} options - Loading options
   * @returns {Promise<object>} Expected output data
   */
  async load_expected_output(test_scenario, options = {}) {
    const { use_cache = true } = options
    const cache_key = `expected:${test_scenario}`

    // Check cache first
    if (use_cache && this.cache.has(cache_key)) {
      return this.cache.get(cache_key)
    }

    try {
      // Try to find the fixture in any subdirectory
      const expected_dir = path.join(this.fixtures_root, 'expected-outputs')
      const fixture_path = await this.find_fixture_file(
        expected_dir,
        `${test_scenario}.json`
      )

      if (!fixture_path) {
        throw new Error(`Expected output fixture not found: ${test_scenario}`)
      }

      const content = await fs.readFile(fixture_path, 'utf8')
      const fixture = JSON.parse(content)

      // Cache the result
      if (use_cache) {
        this.cache.set(cache_key, fixture)
      }

      return fixture
    } catch (err) {
      if (err.message.includes('not found')) {
        throw err
      }
      throw new Error(
        `Failed to load expected output fixture ${test_scenario}: ${err.message}`
      )
    }
  }

  /**
   * Load database state fixture
   * @param {string} state_name - Database state name
   * @param {object} options - Loading options
   * @returns {Promise<object>} Database state data
   */
  async load_database_state(state_name, options = {}) {
    const { use_cache = true } = options
    const cache_key = `database:${state_name}`

    // Check cache first
    if (use_cache && this.cache.has(cache_key)) {
      return this.cache.get(cache_key)
    }

    try {
      // Try to find the fixture in any subdirectory
      const database_dir = path.join(this.fixtures_root, 'database-states')
      const fixture_path = await this.find_fixture_file(
        database_dir,
        `${state_name}.json`
      )

      if (!fixture_path) {
        throw new Error(`Database state fixture not found: ${state_name}`)
      }

      const content = await fs.readFile(fixture_path, 'utf8')
      const fixture = JSON.parse(content)

      // Cache the result
      if (use_cache) {
        this.cache.set(cache_key, fixture)
      }

      return fixture
    } catch (err) {
      if (err.message.includes('not found')) {
        throw err
      }
      throw new Error(
        `Failed to load database state fixture ${state_name}: ${err.message}`
      )
    }
  }

  /**
   * Load edge case fixture
   * @param {string} edge_case_name - Edge case fixture name
   * @param {object} options - Loading options
   * @returns {Promise<object>} Edge case data
   */
  async load_edge_case(edge_case_name, options = {}) {
    const { use_cache = true } = options
    const cache_key = `edge:${edge_case_name}`

    // Check cache first
    if (use_cache && this.cache.has(cache_key)) {
      return this.cache.get(cache_key)
    }

    try {
      const file_path = path.join(
        this.fixtures_root,
        'edge-cases',
        `${edge_case_name}.json`
      )

      const content = await fs.readFile(file_path, 'utf8')
      const fixture = JSON.parse(content)

      // Cache the result
      if (use_cache) {
        this.cache.set(cache_key, fixture)
      }

      return fixture
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Edge case fixture not found: ${edge_case_name}`)
      }
      throw new Error(
        `Failed to load edge case fixture ${edge_case_name}: ${err.message}`
      )
    }
  }

  /**
   * Load multiple platform responses at once
   * @param {Array<{platform: string, data_type: string}>} requests - Array of platform/data_type pairs
   * @param {object} options - Loading options
   * @returns {Promise<object>} Object with platform responses keyed by platform:data_type
   */
  async load_multiple_platform_responses(requests, options = {}) {
    const results = {}

    // Load all fixtures in parallel
    const load_promises = requests.map(async ({ platform, data_type }) => {
      try {
        const fixture = await this.load_platform_response(
          platform,
          data_type,
          options
        )
        results[`${platform}:${data_type}`] = fixture
      } catch (err) {
        results[`${platform}:${data_type}`] = { error: err.message }
      }
    })

    await Promise.all(load_promises)
    return results
  }

  /**
   * Get available fixtures for a platform
   * @param {string} platform - Platform name
   * @returns {Promise<Array<string>>} Array of available data types for the platform
   */
  async get_available_platform_fixtures(platform) {
    try {
      const platform_dir = path.join(
        this.fixtures_root,
        'platform-responses',
        platform
      )
      const files = await fs.readdir(platform_dir)

      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''))
        .sort()
    } catch (err) {
      if (err.code === 'ENOENT') {
        return []
      }
      throw err
    }
  }

  /**
   * Get all available platforms
   * @returns {Promise<Array<string>>} Array of available platforms
   */
  async get_available_platforms() {
    try {
      const platforms_dir = path.join(this.fixtures_root, 'platform-responses')
      const entries = await fs.readdir(platforms_dir, { withFileTypes: true })

      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    } catch (err) {
      if (err.code === 'ENOENT') {
        return []
      }
      throw err
    }
  }

  /**
   * Find a fixture file recursively in a directory
   * @param {string} directory - Directory to search
   * @param {string} filename - Filename to find
   * @returns {Promise<string|null>} Path to the fixture file or null if not found
   */
  async find_fixture_file(directory, filename) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true })

      // Check for direct file match
      const direct_match = entries.find(
        (entry) => entry.isFile() && entry.name === filename
      )
      if (direct_match) {
        return path.join(directory, filename)
      }

      // Search in subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subdirectory_path = path.join(directory, entry.name)
          const result = await this.find_fixture_file(
            subdirectory_path,
            filename
          )
          if (result) {
            return result
          }
        }
      }

      return null
    } catch (err) {
      return null
    }
  }

  /**
   * Clear the fixture cache
   */
  clear_cache() {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  get_cache_stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Preload commonly used fixtures
   * @param {Array<string>} platforms - Platforms to preload (defaults to sleeper and espn)
   * @param {Array<string>} data_types - Data types to preload (defaults to league, players, transactions)
   * @returns {Promise<object>} Preload results
   */
  async preload_fixtures(
    platforms = ['sleeper', 'espn'],
    data_types = ['league', 'players', 'transactions']
  ) {
    const results = {
      loaded: 0,
      failed: 0,
      errors: []
    }

    for (const platform of platforms) {
      for (const data_type of data_types) {
        try {
          await this.load_platform_response(platform, data_type)
          results.loaded++
        } catch (err) {
          results.failed++
          results.errors.push(`${platform}:${data_type} - ${err.message}`)
        }
      }
    }

    return results
  }

  /**
   * Create fixture template for new test scenarios
   * @param {string} platform - Platform name
   * @param {string} data_type - Data type
   * @param {object} sample_data - Sample data for the fixture
   * @returns {object} Fixture template
   */
  create_fixture_template(platform, data_type, sample_data = {}) {
    return {
      platform,
      data_type,
      collected_at: new Date().toISOString(),
      anonymized: true,
      data: sample_data,
      metadata: {
        collection_method: 'manual',
        notes: 'Template fixture - replace with actual data',
        validation_notes: []
      }
    }
  }
}

// Export singleton instance for convenience
const fixture_loader = new FixtureLoader()

// Convenience functions that use the singleton
export async function load_platform_response(
  platform,
  data_type,
  options = {}
) {
  return await fixture_loader.load_platform_response(
    platform,
    data_type,
    options
  )
}

export async function load_expected_output(test_scenario, options = {}) {
  return await fixture_loader.load_expected_output(test_scenario, options)
}

export async function load_database_state(state_name, options = {}) {
  return await fixture_loader.load_database_state(state_name, options)
}

export async function load_edge_case(edge_case_name, options = {}) {
  return await fixture_loader.load_edge_case(edge_case_name, options)
}

export async function get_available_platforms() {
  return await fixture_loader.get_available_platforms()
}

export async function get_available_platform_fixtures(platform) {
  return await fixture_loader.get_available_platform_fixtures(platform)
}

export default fixture_loader
