/**
 * Utilities for transforming play data enum values to standardized database enums
 *
 * This centralizes enum transformations to ensure consistency across all import sources
 * (NFLverse/nflfastr, Sportradar, etc.)
 */

/**
 * Transform kick result values to standardized nfl_kick_result enum
 *
 * Standard enum values: 'made', 'missed', 'blocked', 'aborted'
 *
 * Transformations:
 * - 'good' (NFLverse) -> 'made' (standard)
 * - 'failed' (NFLverse) -> 'missed' (standard)
 * - All other values pass through unchanged
 *
 * @param {string|null} value - Raw kick result value from data source
 * @returns {string|null} - Standardized kick result value or null
 */
export const standardize_kick_result = (value) => {
  if (!value || value === '') {
    return null
  }

  // Transform legacy NFLverse values to standard
  const transformations = {
    good: 'made', // NFLverse extra point success
    failed: 'missed' // NFLverse extra point failure
  }

  return transformations[value] || value
}

/**
 * Transform two-point conversion result to standardized nfl_two_point_result enum
 *
 * Standard enum values: 'success', 'failure'
 *
 * @param {string|null} value - Raw two-point result value
 * @returns {string|null} - Standardized two-point result or null
 */
export const standardize_two_point_result = (value) => {
  if (!value || value === '') {
    return null
  }

  // Currently no transformations needed - NFLverse already uses 'success'/'failure'
  return value
}

/**
 * Transform score type to standardized nfl_score_type enum
 *
 * Standard enum values: 'TD', 'FG', 'PAT', 'PAT2', 'SFTY'
 *
 * Transformations:
 * - Uppercase normalization for consistency
 * - Alternative names mapped to standard values
 *
 * @param {string|null} value - Raw score type value
 * @returns {string|null} - Standardized score type or null
 */
export const standardize_score_type = (value) => {
  if (!value || value === '') {
    return null
  }

  // Normalize to uppercase
  const normalized = value.toUpperCase().trim()

  // Map alternative names to standard enum values
  const transformations = {
    TOUCHDOWN: 'TD',
    'FIELD GOAL': 'FG',
    'EXTRA POINT': 'PAT',
    'TWO-POINT CONVERSION': 'PAT2',
    'TWO POINT CONVERSION': 'PAT2',
    SAFETY: 'SFTY'
  }

  return transformations[normalized] || normalized
}
