import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Load platform configuration from JSON file
 *
 * The platform configuration file contains API endpoints, rate limits, and
 * other platform-specific settings for all supported external fantasy platforms.
 *
 * @param {string} [config_path] - Optional path to platform config file.
 *   If not provided, uses default location: external-platforms.json
 * @returns {Promise<object>} Full platform configuration object with all platforms
 * @throws {Error} If config file cannot be read or parsed
 */
export async function load_platform_config(config_path) {
  const default_config_path = path.join(
    __dirname,
    '..',
    'external-platforms.json'
  )
  const final_config_path = config_path || default_config_path

  try {
    const config_content = await fs.readFile(final_config_path, 'utf8')
    return JSON.parse(config_content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Platform config file not found: ${final_config_path}. ` +
          'Ensure external-platforms.json exists in the external-fantasy-leagues directory.'
      )
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        `Platform config file contains invalid JSON: ${final_config_path}. ` +
          `Parse error: ${error.message}`
      )
    }
    throw new Error(
      `Failed to load platform config from ${final_config_path}: ${error.message}`
    )
  }
}

/**
 * Validate platform configuration structure
 *
 * Ensures that the configuration for a specific platform contains all required fields.
 * Different platforms have different requirements (e.g., some require API keys,
 * others require league IDs, etc.)
 *
 * @param {object} config - Full platform configuration object (from load_platform_config)
 * @param {string} platform - Platform identifier to validate (e.g., 'sleeper', 'espn', 'yahoo')
 * @returns {boolean} True if configuration is valid
 * @throws {Error} If configuration is missing required fields or is invalid
 */
export function validate_platform_config(config, platform) {
  if (!config || typeof config !== 'object') {
    throw new Error('Platform configuration must be an object')
  }

  if (!platform || typeof platform !== 'string') {
    throw new Error('Platform identifier must be a non-empty string')
  }

  const platform_lower = platform.toLowerCase()
  if (!config[platform_lower]) {
    throw new Error(
      `No configuration found for platform: ${platform_lower}. ` +
        `Available platforms: ${Object.keys(config).join(', ')}`
    )
  }

  const platform_config = config[platform_lower]

  // Validate required fields based on platform
  switch (platform_lower) {
    case 'sleeper':
      if (!platform_config.league_id) {
        throw new Error('Sleeper configuration requires league_id field')
      }
      if (!platform_config.api_base_url) {
        throw new Error('Sleeper configuration requires api_base_url field')
      }
      break

    case 'espn':
      if (!platform_config.league_id) {
        throw new Error('ESPN configuration requires league_id field')
      }
      break

    case 'yahoo':
      if (!platform_config.league_id) {
        throw new Error('Yahoo configuration requires league_id field')
      }
      if (
        platform_config.credentials &&
        (!platform_config.credentials.client_id ||
          !platform_config.credentials.client_secret)
      ) {
        throw new Error(
          'Yahoo OAuth credentials require both client_id and client_secret fields'
        )
      }
      break

    case 'mfl':
      if (!platform_config.league_id) {
        throw new Error('MFL configuration requires league_id field')
      }
      break

    default:
      // Generic validation for unknown platforms
      if (!platform_config.league_id) {
        throw new Error(
          `${platform_lower} configuration requires league_id field`
        )
      }
  }

  return true
}

/**
 * Get platform configuration for a specific platform
 *
 * Convenience function that loads and validates configuration for a single platform.
 * This is the recommended way to get platform config in most cases.
 *
 * @param {string} platform - Platform identifier (e.g., 'sleeper', 'espn', 'yahoo')
 * @param {string} [config_path] - Optional path to config file (uses default if not provided)
 * @returns {Promise<object>} Platform-specific configuration object
 * @throws {Error} If platform config cannot be loaded or is invalid
 */
export async function get_platform_config(platform, config_path) {
  const full_config = await load_platform_config(config_path)
  validate_platform_config(full_config, platform)
  const platform_lower = platform.toLowerCase()
  return full_config[platform_lower]
}
