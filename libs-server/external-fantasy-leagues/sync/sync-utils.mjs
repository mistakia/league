/**
 * Shared sync utilities module
 * Contains common data validation functions, transformation utilities, and error handling helpers
 *
 * Provides:
 * - Sync context creation with mappings (teams, players, users)
 * - Sync statistics initialization and management
 * - Parameter validation
 * - Standardized output formatting
 * - Error object creation with consistent structure
 */
export class SyncUtils {
  // Static utility class - no constructor needed

  /**
   * Create a sync context with default mappings
   * @param {Object} options - Sync context options
   * @param {string} options.platform_name - Platform identifier
   * @param {string} options.external_league_id - External league ID
   * @param {string} options.internal_league_id - Internal league ID
   * @param {number} [options.year] - Season year
   * @param {number} [options.week] - Week number
   * @returns {Object} Initialized sync context with mappings for teams, players, and users
   */
  create_sync_context({
    platform_name,
    external_league_id,
    internal_league_id,
    year = new Date().getFullYear(),
    week = 1
  }) {
    return {
      platform: platform_name,
      external_league_id,
      internal_league_id,
      year,
      week,
      team_mappings: new Map(), // external_team_id -> internal_team_id
      player_mappings: new Map(), // external_player_id -> internal_pid
      user_mappings: new Map() // external_user_id -> internal_userid
    }
  }

  /**
   * Initialize sync statistics object
   * @returns {Object} Initialized sync statistics
   */
  init_sync_stats() {
    return {
      players_mapped: 0,
      transactions_imported: 0,
      rosters_updated: 0,
      errors: []
    }
  }

  /**
   * Reset sync statistics to initial state
   * @param {Object} sync_stats - Sync statistics object to reset
   * @returns {Object} Reset sync statistics
   */
  reset_sync_stats(sync_stats) {
    sync_stats.players_mapped = 0
    sync_stats.transactions_imported = 0
    sync_stats.rosters_updated = 0
    sync_stats.errors = []
    return sync_stats
  }

  /**
   * Validate sync parameters
   * @param {Object} params - Parameters to validate
   * @param {string} params.platform_name - Platform identifier
   * @param {string} params.external_league_id - External league ID
   * @param {string} params.internal_league_id - Internal league ID
   * @param {Object} [params.credentials] - Platform credentials
   * @returns {Object} Validation result with valid flag and errors array
   */
  validate_sync_params(params) {
    const errors = []

    if (!params.platform_name) {
      errors.push('Platform name is required')
    }

    if (!params.external_league_id) {
      errors.push('External league ID is required')
    }

    if (!params.internal_league_id) {
      errors.push('Internal league ID is required')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Create standardized sync output
   * @param {Object} options - Output creation options
   * @param {string} options.platform_name - Platform identifier
   * @param {boolean} [options.success] - Whether sync was successful
   * @param {Object} [options.raw_data] - Raw data from platform
   * @param {Object} [options.mapped_data] - Processed/mapped data
   * @param {Object} [options.validation_results] - Validation results
   * @param {Array} [options.errors] - Any errors encountered
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Object} Standardized sync output
   */
  create_standardized_output({
    platform_name,
    success = true,
    raw_data = {},
    mapped_data = {},
    validation_results = {},
    errors = [],
    metadata = {}
  }) {
    const end_time = Date.now()
    const start_time = metadata.start_time || end_time

    return {
      success,
      platform: platform_name,
      timestamp: new Date().toISOString(),
      duration_ms: end_time - start_time,

      // Data components
      raw_data,
      mapped_data,

      // Validation and processing results
      validation: {
        league_config_valid: validation_results.league_config_valid || false,
        players_mapped: validation_results.players_mapped || 0,
        players_failed: validation_results.players_failed || 0,
        transactions_valid: validation_results.transactions_valid || 0,
        transactions_invalid: validation_results.transactions_invalid || 0
      },

      // Error tracking
      errors: errors.map((error_info) => ({
        timestamp: new Date().toISOString(),
        type: error_info.type || 'general',
        message: error_info.message || error_info,
        details: error_info.details || {}
      })),

      // Additional metadata
      metadata: {
        sync_type: metadata.sync_type || 'full',
        dry_run: metadata.dry_run || false,
        ...metadata
      }
    }
  }

  /**
   * Create standardized error object for sync operations
   * @param {Object} options - Error creation options
   * @param {string} options.error_type - Type of error (e.g., 'sync_failure', 'validation_error')
   * @param {string} options.error_message - Error message
   * @param {string} [options.step] - Sync step where error occurred (e.g., 'sync_teams', 'sync_rosters')
   * @param {Object} [options.context_data] - Additional context data (e.g., transaction_id, team_id)
   * @returns {Object} Standardized error object compatible with sync_stats_errors array
   */
  create_sync_error({
    error_type,
    error_message,
    step = 'unknown',
    context_data = {}
  }) {
    return {
      step,
      type: error_type,
      error: error_message, // Use 'error' for consistency with existing code
      message: error_message, // Also include 'message' for standardized output
      timestamp: new Date().toISOString(),
      context: context_data, // Context object for additional error details
      ...context_data // Merge context data directly for easier access
    }
  }
}

export default SyncUtils
