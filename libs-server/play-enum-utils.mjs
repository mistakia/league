/**
 * Utilities for transforming play data enum values and formats to standardized database values
 *
 * This centralizes data transformations to ensure consistency across all import sources
 * (NFLverse/nflfastr, Sportradar, NFL API, NGS, etc.)
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

/**
 * Normalize game clock to standard zero-padded MM:SS format
 *
 * Handles various input formats from different data sources to ensure consistent
 * storage and comparison across all play import pipelines.
 *
 * Format conversions:
 * - "2:00" or "02:00" → "02:00" (zero-pad minutes)
 * - "1:09" or "01:09" → "01:09" (zero-pad minutes)
 * - "15:00" → "15:00" (preserve two-digit minutes)
 * - "2:5" → "02:05" (zero-pad both)
 * - Invalid inputs → null
 *
 * This normalization prevents false collisions in play matching and update_play
 * where semantically identical times like "2:00" and "02:00" would be treated
 * as different values, causing unnecessary update attempts.
 *
 * Validation rules:
 * - Minutes: 0-15 (max quarter length)
 * - Seconds: 0-59
 * - Format: MM:SS (exactly two parts separated by colon)
 *
 * Used by:
 * - import-plays-sportradar.mjs (Sportradar API clock values)
 * - import-plays-nfl-v1.mjs (NFL API clock values)
 * - import-plays-nflfastr.mjs (nflfastR CSV clock values)
 * - import-plays-ngs-detailed.mjs (NGS API clock values)
 * - update-play.mjs (comparison normalization)
 *
 * @param {string} clock_string - Clock time in format M:SS or MM:SS
 * @returns {string|null} - Normalized clock string in MM:SS format or null
 *
 * @example
 * normalize_game_clock('2:00')   // '02:00'
 * normalize_game_clock('02:00')  // '02:00'
 * normalize_game_clock('1:09')   // '01:09'
 * normalize_game_clock('15:00')  // '15:00'
 * normalize_game_clock('2:5')    // '02:05'
 * normalize_game_clock('abc')    // null
 * normalize_game_clock('20:00')  // null (> 15 minutes)
 */
export const normalize_game_clock = (clock_string) => {
  if (!clock_string || typeof clock_string !== 'string') return null

  // Handle empty strings and whitespace
  const trimmed = clock_string.trim()
  if (!trimmed) return null

  // Split on colon
  const parts = trimmed.split(':')
  if (parts.length !== 2) return null

  // Parse minutes and seconds
  const minutes = parseInt(parts[0], 10)
  const seconds = parseInt(parts[1], 10)

  // Validate parsed values
  if (isNaN(minutes) || isNaN(seconds)) return null
  if (minutes < 0 || minutes > 15) return null // Max 15 minutes per quarter
  if (seconds < 0 || seconds > 59) return null

  // Return zero-padded format MM:SS
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
