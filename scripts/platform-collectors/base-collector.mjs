import {
  save_fixture as save_fixture_util,
  create_fixture_structure,
  normalize_response_type_for_path
} from './fixture-utils.mjs'

/**
 * Abstract base class for platform API response collectors
 * Provides common functionality for collecting, anonymizing, and saving platform responses
 */
export class BaseCollector {
  constructor(platform_name, options = {}) {
    this.platform = platform_name
    this.options = {
      anonymize: true,
      save_to_fixtures: true,
      ...options
    }
    this.collected_responses = new Map()
  }

  /**
   * Abstract method to authenticate with platform
   * Must be implemented by subclasses
   * @param {object} _credentials - Platform credentials
   * @returns {Promise<boolean>} Success status
   */
  async authenticate(_credentials) {
    throw new Error('authenticate() must be implemented by subclass')
  }

  /**
   * Abstract method to collect league configuration
   * Must be implemented by subclasses
   * @param {string} _league_id - Platform-specific league identifier
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} League configuration data (raw platform response)
   */
  async collect_league_config(_league_id, _season_year = null) {
    throw new Error('collect_league_config() must be implemented by subclass')
  }

  /**
   * Abstract method to collect roster data
   * Must be implemented by subclasses
   * @param {string} _league_id - Platform-specific league identifier
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} Roster data (raw platform response)
   */
  async collect_rosters(_league_id, _season_year = null) {
    throw new Error('collect_rosters() must be implemented by subclass')
  }

  /**
   * Abstract method to collect player data
   * Must be implemented by subclasses
   * @param {string} [_league_id] - Optional league ID (some platforms require league context)
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} Player data (raw platform response)
   */
  async collect_players(_league_id = null, _season_year = null) {
    throw new Error('collect_players() must be implemented by subclass')
  }

  /**
   * Abstract method to collect transaction data
   * Must be implemented by subclasses
   * @param {string} _league_id - Platform-specific league identifier
   * @param {number} [_week] - Optional week number (platform-specific)
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} Transaction data (raw platform response)
   */
  async collect_transactions(_league_id, _week = null, _season_year = null) {
    throw new Error('collect_transactions() must be implemented by subclass')
  }

  /**
   * Abstract method to get platform-specific information
   * Should be implemented by subclasses to provide platform metadata
   * @returns {object} Platform information object
   */
  get_platform_info() {
    return {
      platform: this.platform,
      base_url: this.base_url || 'unknown',
      supports_authentication: false,
      implementation_status: 'unknown'
    }
  }

  /**
   * Abstract method to anonymize platform-specific data
   * Should be implemented by subclasses for platform-specific anonymization
   * @param {object} data - Raw platform data
   * @param {string} _response_type - Type of response being anonymized
   * @returns {object} Anonymized data
   */
  anonymize_data(data, _response_type) {
    // Base anonymization - subclasses should extend this
    const anonymized = JSON.parse(JSON.stringify(data))

    // Remove common PII patterns
    const anonymize_recursive = (obj, path = '') => {
      if (Array.isArray(obj)) {
        return obj.map((item, i) => anonymize_recursive(item, `${path}[${i}]`))
      }

      if (obj && typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          const lower_key = key.toLowerCase()

          // Skip or anonymize sensitive fields
          if (lower_key.includes('email')) {
            result[key] = 'anonymized@example.com'
          } else if (lower_key.includes('phone')) {
            result[key] = '555-0000'
          } else if (lower_key.includes('address')) {
            result[key] = 'Anonymized Address'
          } else if (lower_key.includes('name') && typeof value === 'string') {
            result[key] = `Anonymized ${key}`
          } else {
            result[key] = anonymize_recursive(value, `${path}.${key}`)
          }
        }
        return result
      }

      return obj
    }

    return anonymize_recursive(anonymized)
  }

  /**
   * Collect and process a specific response type
   * @param {string} response_type - Response type identifier (config key like 'league', 'rosters', etc.)
   *                                 Will be normalized to file-safe name (e.g., 'league' -> 'league-config')
   * @param {string} league_id - Optional league ID for league-specific responses
   * @param {object} options - Additional collection options
   * @param {number} options.week - Optional week number for transactions
   * @param {number} options.season_year - Optional season year
   * @returns {Promise<object>} Processed response data in standardized fixture format
   */
  async collect_response(response_type, league_id = null, options = {}) {
    // Normalize response type for file paths (e.g., 'league' -> 'league-config')
    const normalized_type = normalize_response_type_for_path(response_type)
    // Map to config key for method dispatch (e.g., 'league-config' -> 'league')
    const config_key =
      response_type === 'league-config' ? 'league' : response_type

    console.log(
      `Collecting ${normalized_type} for ${this.platform}${league_id ? ` (league: ${league_id})` : ''}`
    )

    let raw_data

    try {
      switch (config_key) {
        case 'league':
          if (!league_id) {
            throw new Error('League ID required for league configuration')
          }
          raw_data = await this.collect_league_config(
            league_id,
            options.season_year
          )
          break
        case 'rosters':
          if (!league_id) {
            throw new Error('League ID required for rosters')
          }
          raw_data = await this.collect_rosters(league_id, options.season_year)
          break
        case 'players':
          raw_data = await this.collect_players(league_id, options.season_year)
          break
        case 'transactions':
          if (!league_id) {
            throw new Error('League ID required for transactions')
          }
          raw_data = await this.collect_transactions(
            league_id,
            options.week,
            options.season_year
          )
          break
        default:
          throw new Error(`Unknown response type: ${response_type}`)
      }
    } catch (error) {
      console.error(`Failed to collect ${normalized_type}:`, error.message)
      throw error
    }

    // Process the collected data
    let processed_data = raw_data

    // Anonymize if requested
    if (this.options.anonymize) {
      processed_data = this.anonymize_data(raw_data, normalized_type)
    }

    // Create standardized fixture structure using shared utility
    const fixture_data = create_fixture_structure({
      platform: this.platform,
      response_type: config_key,
      data: processed_data,
      options: {
        anonymized: this.options.anonymize,
        league_id: league_id || undefined,
        season_year: options.season_year
      }
    })

    // Save to fixtures if requested
    if (this.options.save_to_fixtures) {
      const fixture_path = `platform-responses/${this.platform}/${normalized_type}.json`
      await save_fixture_util(fixture_path, fixture_data, {
        log_success: false
      })
      console.log(`Saved fixture: ${fixture_path}`)
    }

    // Store in memory for batch processing
    this.collected_responses.set(normalized_type, fixture_data)

    return fixture_data
  }

  /**
   * Collect all standard response types for a league
   * Convenience method that collects league, rosters, transactions, and players in one call
   * @param {string} league_id - Platform-specific league identifier
   * @param {object} options - Collection options
   * @param {number} options.week - Optional week number for transactions
   * @param {number} options.season_year - Optional season year
   * @returns {Promise<Map>} Map of normalized response types (file-safe names) to fixture data
   */
  async collect_all_league_responses(league_id, options = {}) {
    console.log(
      `Collecting all responses for ${this.platform} league ${league_id}`
    )

    // Standard response types (config keys, not normalized file names)
    const response_types = ['league', 'rosters', 'transactions']
    const results = new Map()

    for (const response_type_key of response_types) {
      try {
        const fixture_data = await this.collect_response(
          response_type_key,
          league_id,
          options
        )
        const normalized_type =
          normalize_response_type_for_path(response_type_key)
        results.set(normalized_type, fixture_data)
      } catch (error) {
        console.error(
          `Failed to collect ${response_type_key} for league ${league_id}:`,
          error.message
        )
        const normalized_type =
          normalize_response_type_for_path(response_type_key)
        results.set(normalized_type, { error: error.message })
      }
    }

    // Also collect global players data (may not require league_id for some platforms)
    try {
      const players_data = await this.collect_response(
        'players',
        league_id,
        options
      )
      results.set('players', players_data)
    } catch (error) {
      console.error(`Failed to collect players data:`, error.message)
      results.set('players', { error: error.message })
    }

    return results
  }

  /**
   * Generate summary of collected responses
   * @returns {object} Collection summary
   */
  get_collection_summary() {
    const summary = {
      platform: this.platform,
      collected_count: this.collected_responses.size,
      response_types: Array.from(this.collected_responses.keys()),
      options: this.options,
      timestamp: new Date().toISOString()
    }

    // Add size information
    for (const [type, data] of this.collected_responses) {
      summary[`${type}_size`] = JSON.stringify(data).length
    }

    return summary
  }

  /**
   * Clear collected responses from memory
   */
  clear_collected() {
    this.collected_responses.clear()
  }

  /**
   * Helper method to safely make API requests with error handling
   * @param {string} url - API endpoint URL
   * @param {object} options - Fetch options
   * @returns {Promise<object>} API response data
   */
  async safe_api_request(url, options = {}) {
    const default_options = {
      timeout: 30000,
      retry_count: 3,
      retry_delay: 1000,
      ...options
    }

    let last_error

    for (let attempt = 1; attempt <= default_options.retry_count; attempt++) {
      try {
        console.log(`API request (attempt ${attempt}): ${url}`)

        const controller = new AbortController()
        const timeout_id = setTimeout(
          () => controller.abort(),
          default_options.timeout
        )

        const response = await fetch(url, {
          ...default_options,
          signal: controller.signal
        })

        clearTimeout(timeout_id)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return data
      } catch (error) {
        last_error = error
        console.warn(`API request failed (attempt ${attempt}):`, error.message)

        if (attempt < default_options.retry_count) {
          await new Promise((resolve) =>
            setTimeout(resolve, default_options.retry_delay * attempt)
          )
        }
      }
    }

    throw new Error(
      `API request failed after ${default_options.retry_count} attempts: ${last_error.message}`
    )
  }
}
