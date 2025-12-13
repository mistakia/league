/**
 * Shared utilities for saving platform response fixtures
 * Used by collection scripts to maintain consistent fixture structure
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Get the fixtures root directory
 * @returns {string} Path to fixtures directory
 */
export function get_fixtures_root() {
  return path.join(
    __dirname,
    '..',
    '..',
    'test',
    'fixtures',
    'external-fantasy-leagues'
  )
}

/**
 * Save fixture to file system
 * @param {string} fixture_path - Relative path within fixtures directory
 * @param {object} fixture_data - Fixture data to save
 * @param {object} options - Save options
 * @param {boolean} options.log_success - Whether to log success message (default: true)
 */
export async function save_fixture(
  fixture_path,
  fixture_data,
  { log_success = true } = {}
) {
  const fixtures_root = get_fixtures_root()
  const full_path = path.join(fixtures_root, fixture_path)
  const dir_path = path.dirname(full_path)

  // Ensure directory exists
  await fs.mkdir(dir_path, { recursive: true })

  // Write fixture data
  await fs.writeFile(full_path, JSON.stringify(fixture_data, null, 2), 'utf8')

  if (log_success) {
    console.log(`  ✓ Saved fixture: ${fixture_path}`)
  }
}

/**
 * Normalize response type name for file paths
 * Converts config keys (e.g., "league") to file-safe names (e.g., "league-config")
 *
 * This function maps internal config keys to standardized file path names.
 * For example, the config key "league" becomes "league-config" in file paths
 * to avoid ambiguity with other league-related files.
 *
 * @param {string} response_type - Response type from config or method name
 * @returns {string} Normalized response type for file paths (file-safe name)
 */
export function normalize_response_type_for_path(response_type) {
  // Map config keys to file-safe names
  // Config keys are what we use internally (e.g., 'league')
  // File names are what we save to disk (e.g., 'league-config')
  const type_mapping = {
    league: 'league-config',
    league_config: 'league-config',
    'league-config': 'league-config',
    users: 'users',
    rosters: 'rosters',
    transactions: 'transactions',
    players: 'players',
    draft: 'draft',
    teams: 'teams'
  }

  return type_mapping[response_type] || response_type
}

/**
 * Create standardized fixture structure
 *
 * All fixtures follow a consistent structure for easy parsing and validation.
 * The response_type is normalized to a file-safe name (e.g., 'league' -> 'league-config').
 *
 * @param {object} params - Fixture parameters
 * @param {string} params.platform - Platform name (e.g., 'espn', 'sleeper')
 * @param {string} params.response_type - Response type config key (e.g., 'league', 'rosters')
 *                                        Will be normalized to file-safe name
 * @param {*} params.data - Response data (raw platform response, may be anonymized)
 * @param {object} params.options - Additional options
 * @param {boolean} params.options.anonymized - Whether data was anonymized (default: true)
 * @param {number} params.options.season_year - Season year (optional)
 * @param {string} params.options.league_id - League ID (optional)
 * @returns {object} Standardized fixture object with normalized response_type
 */
export function create_fixture_structure({
  platform,
  response_type,
  data,
  options = {}
}) {
  const fixture = {
    platform,
    response_type: normalize_response_type_for_path(response_type),
    collected_at: new Date().toISOString(),
    anonymized: options.anonymized !== false,
    data
  }

  // Add optional metadata
  if (options.season_year) {
    fixture.season_year = options.season_year
  }

  if (options.league_id) {
    fixture.league_id = options.league_id
  }

  return fixture
}

/**
 * Get response types from platform config
 * Extracts response types from the platform's data_types configuration
 * @param {object} platform_config - Platform configuration object
 * @returns {Array<string>} Array of response type keys
 */
export function get_response_types_from_config(platform_config) {
  if (!platform_config || !platform_config.data_types) {
    return []
  }

  // If data_types is an array, return it directly
  if (Array.isArray(platform_config.data_types)) {
    return platform_config.data_types
  }

  // If data_types is an object, return its keys
  if (typeof platform_config.data_types === 'object') {
    return Object.keys(platform_config.data_types)
  }

  return []
}
