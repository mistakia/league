/**
 * Fields that are exclusively populated by Sportradar and not available
 * from other data sources (nflfastR, FTN Charting, NGS, NFL v1)
 *
 * These fields can be safely overwritten when re-importing Sportradar data
 * without risking data quality from other sources.
 */
export const SPORTRADAR_EXCLUSIVE_FIELDS = new Set([
  // Formation & Pre-Snap
  'pocket_location', // QB pocket movement
  'left_tightends', // Number of TEs on left
  'right_tightends', // Number of TEs on right

  // Play Characteristics
  'blitz', // Boolean indicating blitz (different from FTN's blitzers count)
  'fake_punt', // Fake punt attempt
  'fake_field_goal', // Fake field goal attempt

  // Passing Metrics
  'pocket_time', // Time in pocket (different from NGS time_to_throw)
  'qb_hit', // QB hit/knockdown (also set by import-charted-plays-from-csv)
  'qb_hurry', // QB hurried
  'incomplete_pass_type', // Type of incompletion

  // Advanced Contact Metrics
  'yards_after_any_contact', // Yards after any contact (also set by import-charted-plays-from-csv)
  'broken_tackles_rec', // Broken tackles on receptions
  'broken_tackles_rush', // Broken tackles on rushes

  // Special Teams
  'punt_hang_time', // Punt hang time in seconds
  'punt_inside_20', // Punt downed inside 20
  'punt_touchback', // Punt touchback
  'kickoff_onside', // Onside kick attempt
  'kickoff_touchback', // Kickoff touchback
  'fg_result_detail', // Detailed FG miss reason

  // Defensive Player Tracking
  'sack_player_1_sportradar_id',
  'sack_player_2_sportradar_id',
  'tackle_for_loss_1_sportradar_id',
  'tackle_for_loss_2_sportradar_id',
  'fumble_forced_1_sportradar_id',
  'fumble_recovered_1_sportradar_id',
  'fumble_recovered_team',

  // Penalty Details
  'penalty_type', // Specific penalty description
  'penalty_declined', // Penalty was declined
  'penalty_offset', // Offsetting penalty
  'penalty_player_sportradar_id',
  'play_direction', // Play direction from pass details

  // Kicker/Returner IDs
  'kicker_sportradar_id',
  'punter_sportradar_id',
  'returner_sportradar_id',

  // Metadata
  'wall_clock', // Real-world timestamp
  'sportradar_game_id',
  'sportradar_play_id',
  'sportradar_drive_id',
  'sportradar_play_type'
])

/**
 * Check if a field is exclusively populated by Sportradar
 * @param {string} field_name - Field name to check
 * @returns {boolean} True if field is Sportradar-exclusive
 */
export const is_sportradar_exclusive_field = (field_name) => {
  return SPORTRADAR_EXCLUSIVE_FIELDS.has(field_name)
}
