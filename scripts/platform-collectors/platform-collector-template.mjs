import { BaseCollector } from './base-collector.mjs'

/**
 * TEMPLATE: Platform API response collector
 *
 * Copy this template to create new platform collectors for collecting raw API responses
 * that will be saved as test fixtures.
 *
 * IMPORTANT: This is for collecting RAW platform responses for fixtures, NOT for production use.
 * For production data fetching and transformation, see libs-server/external-fantasy-leagues/adapters/
 *
 * Steps to implement:
 * 1. Copy this file to [platform]-collector.mjs (e.g., cbs-collector.mjs)
 * 2. Replace all [PLATFORM] placeholders with actual platform name (lowercase)
 * 3. Replace [PLATFORM_URL] with actual API base URL
 * 4. Research platform API documentation
 * 5. Implement authentication method (if required)
 * 6. Implement data collection methods (collect_league_config, collect_rosters, etc.)
 * 7. Implement platform-specific anonymization
 * 8. Add platform-specific edge cases
 * 9. Update platform info with accurate details
 * 10. Test with real platform API
 * 11. Register collector in scripts/collect-platform-responses.mjs
 */
export class PlatformCollector extends BaseCollector {
  constructor(options = {}) {
    super('[PLATFORM]', options) // Replace [PLATFORM] with platform name
    this.base_url = '[PLATFORM_URL]' // Replace with actual API URL
    this.authenticated = false
    // Add platform-specific authentication properties here
  }

  /**
   * Platform authentication (customize for each platform's auth method)
   * @param {object} credentials - Platform-specific credentials
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate(credentials = {}) {
    // TODO: Implement platform-specific authentication
    // Examples:
    // - API key authentication
    // - OAuth 2.0 flow
    // - Cookie-based authentication
    // - Username/password login

    throw new Error('[PLATFORM] collector not implemented yet')
  }

  /**
   * Collect league configuration from platform API
   * @param {string} league_id - Platform-specific league identifier
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} League configuration data (raw platform response)
   */
  async collect_league_config(league_id, _season_year = null) {
    if (!this.authenticated) {
      throw new Error('[PLATFORM] collector requires authentication')
    }

    // TODO: Implement league data collection
    // 1. Construct API URL for league data
    // 2. Make authenticated request
    // 3. Return structured response

    throw new Error('[PLATFORM] collector not implemented yet')
  }

  /**
   * Collect roster/team data from platform API
   * @param {string} league_id - Platform-specific league identifier
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} Roster data (raw platform response)
   */
  async collect_rosters(league_id, _season_year = null) {
    if (!this.authenticated) {
      throw new Error('[PLATFORM] collector requires authentication')
    }

    // TODO: Implement roster data collection
    throw new Error('[PLATFORM] collector not implemented yet')
  }

  /**
   * Collect player data from platform API
   * @param {string} [_league_id] - Optional league ID (some platforms require league context)
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} Players data (raw platform response)
   */
  async collect_players(_league_id = null, _season_year = null) {
    if (!this.authenticated) {
      throw new Error('[PLATFORM] collector requires authentication')
    }

    // TODO: Implement player data collection
    throw new Error('[PLATFORM] collector not implemented yet')
  }

  /**
   * Collect transaction data from platform API
   * @param {string} league_id - Platform-specific league identifier
   * @param {number} [_week] - Optional week number (platform-specific)
   * @param {number} [_season_year] - Optional season year (platform-specific)
   * @returns {Promise<object>} Transaction data (raw platform response)
   */
  async collect_transactions(league_id, _week = null, _season_year = null) {
    if (!this.authenticated) {
      throw new Error('[PLATFORM] collector requires authentication')
    }

    // TODO: Implement transaction data collection
    throw new Error('[PLATFORM] collector not implemented yet')
  }

  /**
   * Get headers for platform API requests (customize for each platform)
   * @returns {object} Headers object
   */
  get_headers() {
    const headers = {
      'User-Agent': 'Fantasy League Collector/1.0',
      Accept: 'application/json'
    }

    // TODO: Add platform-specific headers
    // Examples:
    // - Authorization headers
    // - API key headers
    // - Cookie headers
    // - Custom platform headers

    if (this.authenticated) {
      // Add authentication headers here
    }

    return headers
  }

  /**
   * Anonymize platform-specific data
   * @param {object} data - Raw platform data
   * @param {string} response_type - Type of response being anonymized
   * @returns {object} Anonymized data
   */
  anonymize_data(data, response_type) {
    // Start with base anonymization
    const anonymized = super.anonymize_data(data, response_type)

    // TODO: Implement platform-specific anonymization
    // Each platform has unique data structures and fields that need anonymization
    // Common fields to anonymize:
    // - User identifiers and names
    // - Team names and owner information
    // - League names and descriptions
    // - Personal information
    // - Avatar/logo URLs

    const anonymize_platform_recursive = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map((item) => anonymize_platform_recursive(item))
      }

      if (obj && typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          switch (key) {
            // TODO: Add platform-specific field anonymization
            case 'user_id':
            case 'owner_id':
              result[key] =
                `anon_${key}_${Math.random().toString(36).substring(2, 10)}`
              break
            case 'name':
            case 'display_name':
            case 'username':
              result[key] = `Anonymized${Math.floor(Math.random() * 1000)}`
              break
            case 'email':
              result[key] =
                `anon${Math.floor(Math.random() * 1000)}@example.com`
              break
            case 'avatar':
            case 'logo':
              result[key] = null // Remove image URLs
              break
            default:
              result[key] = anonymize_platform_recursive(value)
              break
          }
        }
        return result
      }

      return obj
    }

    return anonymize_platform_recursive(anonymized)
  }

  /**
   * Collect sample edge cases for platform
   * @param {string} league_id - Platform league identifier
   * @returns {Promise<object>} Edge case scenarios
   */
  async collect_edge_cases(league_id) {
    const edge_cases = []

    // TODO: Implement platform-specific edge cases
    // Common edge cases to test:
    // - Invalid league ID
    // - Unauthenticated requests
    // - Invalid parameters
    // - Rate limiting
    // - Network timeouts
    // - Malformed responses

    edge_cases.push({
      case_name: 'not_implemented',
      description: '[PLATFORM] collector is not implemented',
      error_response: '[PLATFORM] collector requires implementation'
    })

    return {
      platform: '[PLATFORM]',
      edge_cases,
      collected_at: new Date().toISOString()
    }
  }

  /**
   * Get platform-specific collection info
   * @returns {object} Platform information
   */
  get_platform_info() {
    return {
      platform: '[PLATFORM]',
      base_url: this.base_url,
      supports_authentication: true, // Update based on platform
      authentication_method: 'unknown', // Update: 'api_key', 'oauth2', 'cookies', etc.
      implementation_status: 'template',
      rate_limits: {
        requests_per_minute: 'unknown',
        notes: 'Platform rate limits need to be researched and documented'
      },
      endpoints: {
        // TODO: Add platform-specific endpoint documentation
        league: '/api/league/{league_id}',
        rosters: '/api/league/{league_id}/rosters',
        players: '/api/players',
        transactions: '/api/league/{league_id}/transactions'
      },
      required_credentials: {
        // TODO: Document required authentication credentials
        api_key: 'Platform API key (if applicable)',
        username: 'Platform username (if applicable)',
        password: 'Platform password (if applicable)'
      },
      implementation_notes: [
        'This is a template - needs platform-specific implementation',
        'Research platform API documentation',
        'Determine authentication method',
        'Identify rate limits and restrictions',
        'Map platform data structures to internal format'
      ]
    }
  }
}

/**
 * Implementation Checklist:
 *
 * [ ] Copy file to [platform]-collector.mjs
 * [ ] Replace [PLATFORM] placeholders (lowercase platform name)
 * [ ] Replace [PLATFORM_URL] with actual API base URL
 * [ ] Research platform API documentation
 * [ ] Implement authenticate() method
 * [ ] Implement collect_league_config() method
 * [ ] Implement collect_rosters() method
 * [ ] Implement collect_players() method (if applicable)
 * [ ] Implement collect_transactions() method
 * [ ] Implement get_headers() method (if authentication required)
 * [ ] Implement anonymize_data() method with platform-specific fields
 * [ ] Implement collect_edge_cases() method
 * [ ] Update get_platform_info() with accurate details
 * [ ] Register collector in scripts/collect-platform-responses.mjs COLLECTORS object
 * [ ] Test with real platform API
 * [ ] Generate test fixtures using collect-platform-responses.mjs
 */
