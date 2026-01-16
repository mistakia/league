import {
  DEFAULT_SCORING_FORMAT_HASH,
  DEFAULT_LEAGUE_FORMAT_HASH
} from '#libs-shared'

/**
 * Extracts a single value from a parameter that may be an array or single value
 * @param {*} value - The parameter value (may be array or single)
 * @param {*} default_value - Default value if value is undefined or null
 * @returns {*} Single value (first element if array, otherwise the value itself)
 */
export const get_single_value = (value, default_value) => {
  if (value === undefined || value === null) {
    return default_value
  }
  if (Array.isArray(value)) {
    return value[0] !== undefined ? value[0] : default_value
  }
  return value
}

/**
 * Extracts the scoring format hash from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} Scoring format hash
 */
export const get_scoring_format_hash = (params = {}) => {
  return get_single_value(
    params.scoring_format_hash,
    DEFAULT_SCORING_FORMAT_HASH
  )
}

/**
 * Extracts the league format hash from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} League format hash
 */
export const get_league_format_hash = (params = {}) => {
  return get_single_value(params.league_format_hash, DEFAULT_LEAGUE_FORMAT_HASH)
}
