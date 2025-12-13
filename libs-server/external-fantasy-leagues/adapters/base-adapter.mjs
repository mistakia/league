import debug from 'debug'

// Debug namespaces for external fantasy league adapters
// Usage:
//   DEBUG=external:adapter* - All adapter logs
//   DEBUG=external:adapter:validation - Per-item validation logs (verbose)
//   DEBUG=external:adapter:sleeper - Sleeper-specific logs
//   DEBUG=external:adapter:espn - ESPN-specific logs
const log_validation = debug('external:adapter:validation')

/**
 * Base adapter class for external fantasy league platforms
 *
 * Provides standardized interface for league import and sync operations.
 * All platform-specific adapters must extend this class and implement the required methods.
 *
 * The adapter pattern transforms platform-specific data formats into a canonical format
 * that can be consistently processed by the sync orchestrator.
 *
 * @abstract
 */
export default class BaseAdapter {
  /**
   * Create a new adapter instance
   * @param {Object} [config={}] - Platform-specific configuration options
   */
  constructor(config = {}) {
    this.config = config
    this.platform = this.constructor.name.toLowerCase().replace('adapter', '')

    // Authentication state - subclasses should set these appropriately
    this.authenticated = false
    this.requires_authentication = false // Whether platform requires auth for any operations
    this.supports_private_leagues = false // Whether authenticated access enables private leagues

    // Create platform-specific debug logger
    this._log = debug(`external:adapter:${this.platform}`)
    this._log_validation = log_validation
  }

  /**
   * Get platform name
   * @returns {string} Platform identifier
   */
  get_platform() {
    return this.platform
  }

  /**
   * Authenticate with the platform (if required)
   * @param {Object} credentials - Platform-specific credentials
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate(credentials) {
    throw new Error(
      `authenticate() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get league information in canonical format
   * @param {string} league_id - External league identifier
   * @param {Object} [options={}] - Additional options (e.g., year for multi-season platforms)
   * @returns {Promise<Object>} League configuration data in canonical format
   */
  async get_league(league_id, options = {}) {
    throw new Error(
      `get_league() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get teams in a league
   * @param {string} league_id - External league identifier
   * @returns {Promise<Array>} Array of team objects
   */
  async get_teams(league_id) {
    throw new Error(
      `get_teams() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get rosters for all teams in a league in canonical format
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - External league identifier
   * @param {number} [params.week] - Optional week number for historical data
   * @param {number} [params.year] - Optional year for multi-season platforms
   * @returns {Promise<Array>} Array of roster objects in canonical format
   */
  async get_rosters({ league_id, week = null, year = null }) {
    throw new Error(
      `get_rosters() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get players available on the platform
   * @param {Object} [params] - Parameters object
   * @param {Object} [params.filters] - Optional filters for players
   * @returns {Promise<Array>} Array of player objects
   */
  async get_players({ filters = {} } = {}) {
    throw new Error(
      `get_players() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get transactions for a league in canonical format
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - External league identifier
   * @param {Object} [params.options={}] - Optional filters (week, transaction_type, team_id, etc.)
   * @param {number} [params.year] - Optional year for multi-season platforms
   * @returns {Promise<Array>} Array of transaction objects in canonical format
   */
  async get_transactions({ league_id, options = {}, year = null }) {
    throw new Error(
      `get_transactions() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get matchups for a specific week
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - External league identifier
   * @param {number} params.week - Week number
   * @returns {Promise<Array>} Array of matchup objects
   */
  async get_matchups({ league_id, week }) {
    throw new Error(
      `get_matchups() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get league scoring format/rules
   * @param {string} league_id - External league identifier
   * @returns {Promise<Object>} Scoring format configuration
   */
  async get_scoring_format(league_id) {
    throw new Error(
      `get_scoring_format() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Get draft results for a league
   * @param {string} league_id - External league identifier
   * @returns {Promise<Array>} Array of draft pick objects
   */
  async get_draft_results(league_id) {
    throw new Error(
      `get_draft_results() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Map external player ID to internal PID
   * @param {string} external_player_id - Platform-specific player ID
   * @returns {Promise<string|null>} Internal player ID or null if not found
   */
  async map_player_to_internal(external_player_id) {
    throw new Error(
      `map_player_to_internal() must be implemented by ${this.constructor.name}`
    )
  }

  /**
   * Validate league configuration data (legacy method - use schema_validator for canonical format)
   * @param {Object} league_data - League data to validate
   * @returns {boolean} True if valid
   * @deprecated Use schema_validator.validate_league() for canonical format validation
   */
  validate_league_data(league_data) {
    if (!league_data || typeof league_data !== 'object') {
      return false
    }

    // Legacy validation - checks for old format fields
    const required_fields = ['id', 'name', 'settings']
    return required_fields.every((field) => field in league_data)
  }

  /**
   * Validate roster data (legacy method - use schema_validator for canonical format)
   * @param {Object} roster_data - Roster data to validate
   * @returns {boolean} True if valid
   * @deprecated Use schema_validator.validate_roster() for canonical format validation
   */
  validate_roster_data(roster_data) {
    if (!roster_data || typeof roster_data !== 'object') {
      return false
    }

    // Legacy validation - checks for old format fields
    // Canonical format uses team_external_id, not team_id
    const required_fields = ['team_id', 'players']
    return (
      required_fields.every((field) => field in roster_data) &&
      Array.isArray(roster_data.players)
    )
  }

  /**
   * Validate transaction data
   * @param {Object} transaction_data - Transaction data to validate
   * @returns {boolean} True if valid
   */
  validate_transaction_data(transaction_data) {
    if (!transaction_data || typeof transaction_data !== 'object') {
      return false
    }

    const required_fields = ['type', 'timestamp']
    return required_fields.every((field) => field in transaction_data)
  }

  /**
   * Handle API rate limiting (to be implemented by subclasses as needed)
   * @param {number} delay - Delay in milliseconds
   * @returns {Promise<void>}
   */
  async rate_limit(delay = 1000) {
    return new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Log adapter activity using debug library
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} [data={}] - Additional data to log
   */
  log(level, message, data = {}) {
    const log_data = {
      platform: this.platform,
      ...data
    }

    // Use appropriate debug namespace based on level
    switch (level) {
      case 'debug':
        // Validation and per-item logs go to verbose namespace
        this._log_validation('%s %O', message, log_data)
        break
      case 'info':
      case 'warn':
      case 'error':
      default:
        // Platform-specific logs
        this._log('%s [%s] %O', message, level, log_data)
        break
    }
  }

  /**
   * Check if adapter is ready for use (authenticated if required)
   * @returns {boolean} True if adapter is ready
   */
  is_ready() {
    if (this.requires_authentication && !this.authenticated) {
      return false
    }
    return true
  }

  /**
   * Throw error if adapter is not ready for use
   * @throws {Error} If adapter requires authentication but is not authenticated
   */
  require_authentication() {
    if (this.requires_authentication && !this.authenticated) {
      throw new Error(
        `${this.platform} adapter requires authentication before use`
      )
    }
  }
}
