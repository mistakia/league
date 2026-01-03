/**
 * Utilities for transforming play data enum values and formats to standardized database values
 *
 * This centralizes data transformations to ensure consistency across all import sources
 * (NFLverse/nflfastr, Sportradar, NFL API, NGS, etc.)
 */

import debug from 'debug'

const log = debug('play-enum-utils')

// Valid enum values from database (nfl_kick_result)
const VALID_KICK_RESULTS = new Set(['made', 'missed', 'blocked', 'aborted'])

// Valid enum values from database (nfl_two_point_result)
const VALID_TWO_POINT_RESULTS = new Set(['success', 'failure'])

// Valid enum values from database (nfl_score_type)
const VALID_SCORE_TYPES = new Set(['TD', 'FG', 'PAT', 'PAT2', 'SFTY'])

// Valid enum values for drive_start_transition (from database analysis)
const VALID_DRIVE_START_TRANSITIONS = new Set([
  'KICKOFF',
  'PUNT',
  'INTERCEPTION',
  'FUMBLE',
  'DOWNS',
  'MISSED_FG',
  'MUFFED_PUNT',
  'ONSIDE_KICK',
  'BLOCKED_FG',
  'BLOCKED_PUNT',
  'MUFFED_KICKOFF',
  'BLOCKED_FG_DOWNS',
  'BLOCKED_PUNT_DOWNS',
  'OWN_KICKOFF',
  'MUFFED_FG',
  'TOUCHDOWN', // Rare but valid
  'FIELD_GOAL', // Rare but valid
  'END_HALF' // Rare but valid (not END_OF_HALF)
])

// Valid enum values for drive_end_transition (from database analysis)
const VALID_DRIVE_END_TRANSITIONS = new Set([
  'PUNT',
  'TOUCHDOWN',
  'FIELD_GOAL',
  'INTERCEPTION',
  'DOWNS',
  'MISSED_FG',
  'FUMBLE',
  'END_GAME',
  'END_HALF',
  'BLOCKED_FG',
  'BLOCKED_PUNT',
  'SAFETY',
  'BLOCKED_FG_DOWNS',
  'BLOCKED_PUNT_DOWNS',
  'FUMBLE_SAFETY'
])

/**
 * Transform kick result values to standardized nfl_kick_result enum
 *
 * Standard enum values: 'made', 'missed', 'blocked', 'aborted'
 *
 * Transformations:
 * - 'good' (NFLverse) -> 'made' (standard)
 * - 'failed' (NFLverse) -> 'missed' (standard)
 * - Invalid values return null (not passed through)
 *
 * @param {string|null} value - Raw kick result value from data source
 * @returns {string|null} - Standardized kick result value or null if invalid
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

  const transformed = transformations[value] || value

  // Validate against database enum values
  if (!VALID_KICK_RESULTS.has(transformed)) {
    log(
      `Invalid kick_result value: "${value}" (transformed: "${transformed}") - valid values: ${Array.from(VALID_KICK_RESULTS).join(', ')}`
    )
    return null
  }

  return transformed
}

/**
 * Transform two-point conversion result to standardized nfl_two_point_result enum
 *
 * Standard enum values: 'success', 'failure'
 *
 * @param {string|null} value - Raw two-point result value
 * @returns {string|null} - Standardized two-point result or null if invalid
 */
export const standardize_two_point_result = (value) => {
  if (!value || value === '') {
    return null
  }

  // Validate against database enum values
  if (!VALID_TWO_POINT_RESULTS.has(value)) {
    log(
      `Invalid two_point_result value: "${value}" - valid values: ${Array.from(VALID_TWO_POINT_RESULTS).join(', ')}`
    )
    return null
  }

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
 * - Invalid values return null (not passed through)
 *
 * @param {string|null} value - Raw score type value
 * @returns {string|null} - Standardized score type or null if invalid
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

  const transformed = transformations[normalized] || normalized

  // Validate against database enum values
  if (!VALID_SCORE_TYPES.has(transformed)) {
    log(
      `Invalid score_type value: "${value}" (normalized: "${normalized}", transformed: "${transformed}") - valid values: ${Array.from(VALID_SCORE_TYPES).join(', ')}`
    )
    return null
  }

  return transformed
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

/**
 * Normalize drive start transition values to standard database enum format
 *
 * Ensures consistent drive start transition values across all data sources
 * (NFLverse/nflfastr, Sportradar, NFL API, etc.) to prevent false collisions
 * and maintain data consistency.
 *
 * Format rules:
 * - Uppercase with underscores (e.g., "KICKOFF", "MISSED_FG")
 * - Sportradar "End of Half" → "END_HALF"
 * - Normalize comma variations: "BLOCKED_FG,_DOWNS" → "BLOCKED_FG_DOWNS"
 * - Invalid values return null (not passed through)
 *
 * Valid start transition values:
 * - KICKOFF, PUNT, INTERCEPTION, FUMBLE, DOWNS, MISSED_FG
 * - MUFFED_PUNT, ONSIDE_KICK, BLOCKED_FG, BLOCKED_PUNT
 * - MUFFED_KICKOFF, BLOCKED_FG_DOWNS, BLOCKED_PUNT_DOWNS
 * - OWN_KICKOFF, MUFFED_FG, TOUCHDOWN, FIELD_GOAL, END_HALF
 *
 * Used by:
 * - import-plays-sportradar.mjs (map_drive_data)
 * - import-plays-nflfastr.mjs (format_drive_data)
 * - Any other import sources that provide drive start transition data
 *
 * @param {string|null} transition - Raw transition value from data source
 * @returns {string|null} - Normalized transition value or null if invalid
 *
 * @example
 * normalize_drive_start_transition('Kickoff')        // 'KICKOFF'
 * normalize_drive_start_transition('Missed FG')      // 'MISSED_FG'
 * normalize_drive_start_transition('End of Half')    // 'END_HALF'
 * normalize_drive_start_transition('KICKOFF')        // 'KICKOFF' (already normalized)
 * normalize_drive_start_transition(null)             // null
 */
export const normalize_drive_start_transition = (transition) => {
  if (!transition || transition === '') return null

  // Convert to uppercase with underscores
  let normalized = transition.toUpperCase().trim().replace(/\s+/g, '_')

  // Normalize comma variations (e.g., "BLOCKED_FG,_DOWNS" → "BLOCKED_FG_DOWNS")
  normalized = normalized.replace(/,_/g, '_')

  // Map Sportradar-specific values to standard database enum values
  // Note: Database uses END_HALF (not END_OF_HALF)
  const transition_mapping = {
    END_OF_HALF: 'END_HALF'
  }

  const transformed = transition_mapping[normalized] || normalized

  // Validate against drive start enum set
  const valid_values = Array.from(VALID_DRIVE_START_TRANSITIONS)
    .sort()
    .join(', ')

  if (!VALID_DRIVE_START_TRANSITIONS.has(transformed)) {
    log(
      `Invalid drive_start_transition value: "${transition}" (normalized: "${normalized}", transformed: "${transformed}") - valid values: ${valid_values}`
    )
    return null
  }

  return transformed
}

/**
 * Normalize drive end transition values to standard database enum format
 *
 * Ensures consistent drive end transition values across all data sources
 * (NFLverse/nflfastr, Sportradar, NFL API, etc.) to prevent false collisions
 * and maintain data consistency.
 *
 * Format rules:
 * - Uppercase with underscores (e.g., "END_GAME", "MISSED_FG")
 * - Sportradar "End of Game" → "END_GAME"
 * - Sportradar "End of Half" → "END_HALF"
 * - Normalize comma variations: "BLOCKED_FG,_DOWNS" → "BLOCKED_FG_DOWNS"
 * - Invalid values return null (not passed through)
 *
 * Valid end transition values:
 * - PUNT, TOUCHDOWN, FIELD_GOAL, INTERCEPTION, DOWNS, MISSED_FG
 * - FUMBLE, END_GAME, END_HALF, BLOCKED_FG, BLOCKED_PUNT
 * - SAFETY, BLOCKED_FG_DOWNS, BLOCKED_PUNT_DOWNS, FUMBLE_SAFETY
 *
 * Used by:
 * - import-plays-sportradar.mjs (map_drive_data)
 * - import-plays-nflfastr.mjs (format_drive_data)
 * - Any other import sources that provide drive end transition data
 *
 * @param {string|null} transition - Raw transition value from data source
 * @returns {string|null} - Normalized transition value or null if invalid
 *
 * @example
 * normalize_drive_end_transition('End of Game')     // 'END_GAME'
 * normalize_drive_end_transition('End of Half')     // 'END_HALF'
 * normalize_drive_end_transition('Missed FG')       // 'MISSED_FG'
 * normalize_drive_end_transition('END_GAME')        // 'END_GAME' (already normalized)
 * normalize_drive_end_transition('TOUCHDOWN')       // 'TOUCHDOWN'
 * normalize_drive_end_transition(null)              // null
 */
export const normalize_drive_end_transition = (transition) => {
  if (!transition || transition === '') return null

  // Convert to uppercase with underscores
  let normalized = transition.toUpperCase().trim().replace(/\s+/g, '_')

  // Normalize comma variations (e.g., "BLOCKED_FG,_DOWNS" → "BLOCKED_FG_DOWNS")
  normalized = normalized.replace(/,_/g, '_')

  // Map Sportradar-specific values to standard database enum values
  // Note: Database uses END_GAME and END_HALF (not END_OF_GAME/END_OF_HALF)
  const transition_mapping = {
    END_OF_GAME: 'END_GAME',
    END_OF_HALF: 'END_HALF'
  }

  const transformed = transition_mapping[normalized] || normalized

  // Validate against drive end enum set
  const valid_values = Array.from(VALID_DRIVE_END_TRANSITIONS).sort().join(', ')

  if (!VALID_DRIVE_END_TRANSITIONS.has(transformed)) {
    log(
      `Invalid drive_end_transition value: "${transition}" (normalized: "${normalized}", transformed: "${transformed}") - valid values: ${valid_values}`
    )
    return null
  }

  return transformed
}
