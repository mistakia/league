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
 * Expand a set of base years by a year_offset range into the sorted, deduped
 * set of target years actually reachable by some (base_year, offset) pair.
 * `{ base_year + off : base_year in years, off in [min..max] }`. A single
 * offset [k,k] collapses to `{ y + k }`. Mirrors the cross-product the
 * source-attach `emit_year_match` no-anchor branch and select-string's
 * `compute_year_in_list` already build, so CTE-backed sources can scope their
 * own year filter to the same set the correlation predicate will reference.
 * @param {Array<number>} years - base/anchor years
 * @param {[number, number]|null} offset_range - from resolve_year_offset_range
 * @returns {Array<number>} sorted unique target years (base years unchanged when offset_range is null)
 */
export const offset_expanded_years = (years, offset_range) => {
  const base = (Array.isArray(years) ? years : [years])
    .map(Number)
    .filter((n) => Number.isFinite(n))
  if (!offset_range) return base
  const [min_off, max_off] = offset_range
  const out = new Set()
  for (const y of base) {
    for (let off = min_off; off <= max_off; off++) out.add(y + off)
  }
  return [...out].sort((a, b) => a - b)
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
 * Extracts the scoring format id from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} Scoring format id
 */
export const get_scoring_format_id = (params = {}) => {
  return get_single_value(params.scoring_format_id, DEFAULT_SCORING_FORMAT_ID)
}

/**
 * Extracts the league format id from params with proper default handling
 * @param {Object} params - Column parameters object
 * @returns {string} League format id
 */
export const get_league_format_id = (params = {}) => {
  return get_single_value(params.league_format_id, DEFAULT_LEAGUE_FORMAT_ID)
}
