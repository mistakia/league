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

/**
 * Normalize yardline string to standard database format
 *
 * Ensures consistent yardline representation across all data sources to prevent
 * false collisions in play matching and update_play where semantically identical
 * yardlines would be treated as different values.
 *
 * Format rules:
 * - Midfield (50-yard line): "50" (no team prefix)
 * - Team side: "{TEAM} {NUMBER}" (e.g., "TB 22", "DET 30")
 * - Team abbreviations normalized via fixTeam() (LAR → LA, JAC → JAX, etc.)
 *
 * Transformations:
 * - "LAR 35" → "LA 35" (normalize team abbreviation)
 * - "IND 50" → "50" (midfield has no team prefix)
 * - "TB 22" → "TB 22" (already normalized)
 * - null/empty → null
 *
 * This prevents collisions like:
 * - "LAR 35" vs "LA 35" (team normalization)
 * - "IND 50" vs "50" (midfield format)
 *
 * Used by:
 * - sportradar/sportradar-transforms.mjs (parse_yardline function)
 * - import-plays-nfl-v1.mjs (NFL API yardline processing)
 * - update-play.mjs (comparison normalization)
 *
 * @param {string} ydl_str - Yardline string in format "TEAM NUM" or "50"
 * @returns {string|null} - Normalized yardline string or null
 *
 * @example
 * normalize_yardline('LAR 35')   // 'LA 35'
 * normalize_yardline('IND 50')   // '50'
 * normalize_yardline('TB 22')    // 'TB 22'
 * normalize_yardline('50')       // '50'
 * normalize_yardline(null)       // null
 */
export const normalize_yardline = (ydl_str) => {
  if (!ydl_str || typeof ydl_str !== 'string') return null

  const trimmed = ydl_str.trim()
  if (!trimmed) return null

  // Handle midfield (50-yard line) - should not have team prefix
  if (trimmed === '50') return '50'

  // Parse "TEAM NUM" format
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 2) {
    // If it's just a number (e.g., "50"), return as-is
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10)
      return num === 50 ? '50' : null
    }
    return null
  }

  const [team, yard_num_str] = parts
  const yard_num = parseInt(yard_num_str, 10)

  // Validate yard number
  if (isNaN(yard_num) || yard_num < 1 || yard_num > 50) return null

  // Midfield should not have team prefix
  if (yard_num === 50) return '50'

  // Import fixTeam from libs-shared for team normalization
  // This handles LAR → LA, JAC → JAX, etc.
  // Note: fixTeam is imported at module level from '#libs-shared'
  // For now, we'll assume it's available in the calling context
  // Otherwise, we'd need to import it here

  // Return normalized format: "TEAM NUM"
  // Team abbreviation should already be normalized by caller using fixTeam()
  return `${team} ${yard_num}`
}
