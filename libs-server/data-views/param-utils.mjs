import {
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from '#libs-shared'

/**
 * Resolve params.year_offset into [min, max]. Returns null when no offset is
 * specified so callers can take their non-offset code path. Shared across the
 * source-attach rules and aggregator-rate join logic.
 * @param {Object} params
 * @returns {[number, number]|null}
 */
export const resolve_year_offset_range = (params) => {
  const raw = params && params.year_offset
  if (raw == null) return null
  const arr = Array.isArray(raw) ? raw : [raw, raw]
  if (!arr.length) return null
  const nums = arr.map(Number).filter((n) => Number.isFinite(n))
  if (!nums.length) return null
  return [Math.min(...nums), Math.max(...nums)]
}

/**
 * Normalise a career_year or career_game param (which arrives as a 2-element
 * array [lo, hi] in any order) into a guaranteed [lo, hi] pair where lo <=
 * hi. Used by the three play-by-play with-statement builders.
 * @param {Array} arr - Two-element array [a, b]
 * @returns {[number, number]} [min, max]
 */
export const normalize_career_year_range = (arr) => [
  Math.min(Number(arr[0]), Number(arr[1])),
  Math.max(Number(arr[0]), Number(arr[1]))
]

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
export const get_scoring_format_id = (params = {}) => {
  return get_single_value(
    params.scoring_format_id,
    DEFAULT_SCORING_FORMAT_ID
  )
}

/**
 * Extracts the league format hash from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} League format hash
 */
export const get_league_format_id = (params = {}) => {
  return get_single_value(params.league_format_id, DEFAULT_LEAGUE_FORMAT_ID)
}
