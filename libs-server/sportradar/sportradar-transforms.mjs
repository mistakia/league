/**
 * Transformation utilities for converting Sportradar data formats
 * to database enum values and standardized formats
 */

import { fixTeam } from '#libs-shared'
import { normalize_yardline } from '#libs-server/play-enum-utils.mjs'

/**
 * Map Sportradar play type to nfl_play_type enum
 */
export const map_play_type = (sportradar_type) => {
  const type_mapping = {
    pass: 'PASS',
    rush: 'RUSH',
    field_goal: 'FGXP',
    extra_point: 'FGXP',
    punt: 'PUNT',
    kickoff: 'KOFF',
    conversion: 'CONV',
    free_kick: 'FREE',
    faircatch_kick: 'FREE',
    penalty: 'NOPL'
  }

  return type_mapping[sportradar_type] || 'NOPL'
}

/**
 * Transform enum value from Sportradar title case to lowercase_with_underscores
 */
export const transform_to_enum_value = (value) => {
  if (!value) return null
  return value.toLowerCase().replace(/\s+/g, '_')
}

/**
 * Transform Sportradar qb_at_snap to quarterback_position enum
 */
export const transform_qb_position = (value) => {
  if (!value) return null
  const mapping = {
    Shotgun: 'SHOTGUN',
    'Under Center': 'UNDER_CENTER',
    Pistol: 'PISTOL'
  }
  return mapping[value] || null
}

/**
 * Transform Sportradar hash_mark to starting_hash enum
 */
export const transform_hash_position = (value) => {
  if (!value) return null
  const mapping = {
    'Left Hash': 'LEFT',
    Middle: 'MIDDLE',
    'Right Hash': 'RIGHT'
  }
  return mapping[value] || null
}

/**
 * Transform Sportradar running_lane to run_gap enum
 * @param {number} lane - Sportradar running_lane value (0-8)
 */
export const transform_run_gap = (lane) => {
  if (lane === null || lane === undefined) return null
  const mapping = {
    0: 'LEFT_END',
    1: 'LEFT_TACKLE',
    2: 'LEFT_GUARD',
    3: 'LEFT_MIDDLE',
    4: 'MIDDLE',
    5: 'RIGHT_MIDDLE',
    6: 'RIGHT_GUARD',
    7: 'RIGHT_TACKLE',
    8: 'RIGHT_END'
  }
  return mapping[lane] || null
}

/**
 * Map Sportradar direction to play_direction enum (LEFT, MIDDLE, RIGHT)
 */
export const map_play_direction = (direction) => {
  if (!direction) return null

  const dir = direction.toLowerCase()

  if (dir.includes('left')) return 'LEFT'
  if (dir.includes('middle')) return 'MIDDLE'
  if (dir.includes('right')) return 'RIGHT'

  return null
}

/**
 * Transform Sportradar pocket_location to nfl_pocket_location enum
 */
export const transform_pocket_location = (value) => {
  if (!value) return null
  const mapping = {
    Middle: 'middle',
    'Scramble Left': 'scramble_left',
    'Scramble Right': 'scramble_right',
    'Rollout Left': 'rollout_left',
    'Rollout Right': 'rollout_right',
    'Boot Left': 'boot_left',
    'Boot Right': 'boot_right'
  }
  return mapping[value] || null
}

/**
 * Parse clock string (MM:SS) to seconds
 */
export const parse_clock_to_seconds = (clock_string) => {
  if (!clock_string) return null
  const [min, sec] = clock_string.split(':').map(Number)
  if (isNaN(min) || isNaN(sec)) return null
  return min * 60 + sec
}

/**
 * Calculate seconds remaining in game
 */
export const calculate_time_remaining = (qtr, seconds_remaining_quarter) => {
  if (
    !qtr ||
    seconds_remaining_quarter === null ||
    seconds_remaining_quarter === undefined
  ) {
    return {
      seconds_remaining_quarter: null,
      seconds_remaining_half: null,
      seconds_remaining_game: null
    }
  }

  const is_first_half = qtr <= 2
  const quarters_remaining = 4 - qtr
  const seconds_remaining_half = is_first_half
    ? seconds_remaining_quarter + (2 - qtr) * 900
    : seconds_remaining_quarter + (4 - qtr) * 900

  const seconds_remaining_game =
    seconds_remaining_quarter + quarters_remaining * 900

  return {
    seconds_remaining_quarter,
    seconds_remaining_half,
    seconds_remaining_game
  }
}

/**
 * Parse yardline location object from Sportradar
 */
export const parse_yardline = (location, pos_team) => {
  if (!location || !location.yardline) return {}

  const yard_line_num = location.yardline
  const yard_line_side = location.alias

  // Normalize team abbreviation (JAC → JAX, etc.) for comparison
  const normalized_ydl_side = fixTeam(yard_line_side)

  // Calculate 100-yard scale per nflfastR convention:
  // 0 = at opponent's goal line, 100 = at own goal line
  const yard_line_100 =
    normalized_ydl_side === pos_team ? 100 - yard_line_num : yard_line_num

  // Build raw yardline string
  const raw_ydl_str =
    yard_line_num === 50 ? '50' : `${normalized_ydl_side} ${yard_line_num}`

  return {
    yard_line_side: yard_line_num === 50 ? null : normalized_ydl_side,
    yard_line_num,
    yard_line_100,
    ydl_str: normalize_yardline(raw_ydl_str)
  }
}

/**
 * Normalize drive duration to M:SS format (remove leading zero from minutes)
 * Sportradar provides "00:31" or "03:18", database expects "0:31" and "3:18"
 */
export const normalize_drive_duration = (duration) => {
  if (!duration) return null

  // Split into minutes and seconds
  const parts = duration.split(':')
  if (parts.length !== 2) return duration

  // Remove leading zeros from minutes, keep seconds as-is
  const minutes = parseInt(parts[0], 10)
  const seconds = parts[1]

  return `${minutes}:${seconds}`
}
