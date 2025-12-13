/**
 * Shared helper functions for stub adapters (not yet implemented)
 * Reduces code duplication across stub adapter implementations
 */

/**
 * Create a standardized "not implemented" error message
 * @param {string} platform_name - Platform name
 * @param {string} method_name - Method name that's not implemented
 * @param {Object} [context={}] - Additional context (e.g., league_id, week)
 * @returns {Error} Standardized error
 */
export function create_not_implemented_error(
  platform_name,
  method_name,
  context = {}
) {
  const context_str =
    Object.keys(context).length > 0
      ? ` with context: ${JSON.stringify(context)}`
      : ''
  return new Error(
    `${platform_name} adapter: ${method_name}() is not yet implemented${context_str}`
  )
}

/**
 * Log a "not implemented" warning
 * @param {Function} log_fn - Adapter's log function
 * @param {string} method_name - Method name
 * @param {Object} [context={}] - Additional context
 */
export function log_not_implemented(log_fn, method_name, context = {}) {
  log_fn('warn', `${method_name} not yet implemented`, context)
}

/**
 * Standard stub implementation for authenticate method
 * @param {Function} log_fn - Adapter's log function
 * @param {string} platform_name - Platform name
 * @returns {Promise<boolean>} Always returns false
 */
export async function stub_authenticate(log_fn, platform_name) {
  log_fn('warn', `${platform_name} adapter authentication not yet implemented`)
  return false
}

/**
 * Standard stub implementation for get methods
 * @param {Function} log_fn - Adapter's log function
 * @param {string} platform_name - Platform name
 * @param {string} method_name - Method name
 * @param {Object} [context={}] - Method context
 * @throws {Error} Always throws "not implemented" error
 */
export function stub_get_method(
  log_fn,
  platform_name,
  method_name,
  context = {}
) {
  log_not_implemented(log_fn, `${platform_name} ${method_name}`, context)
  throw create_not_implemented_error(platform_name, method_name, context)
}

/**
 * Standard stub implementation for map_player_to_internal
 * @param {Function} log_fn - Adapter's log function
 * @param {string} platform_name - Platform name
 * @param {string} external_player_id - External player ID
 * @returns {Promise<null>} Always returns null
 */
export async function stub_map_player_to_internal(
  log_fn,
  platform_name,
  external_player_id
) {
  log_not_implemented(log_fn, `${platform_name} map_player_to_internal`, {
    external_player_id
  })
  return null
}
