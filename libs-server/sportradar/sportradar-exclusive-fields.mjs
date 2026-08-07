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
  'is_blitz', // Boolean indicating blitz (different from FTN's blitzers count)
  'is_fake_punt', // Fake punt attempt
  'is_fake_field_goal', // Fake field goal attempt

  // Passing Metrics
  'pocket_time', // Time in pocket (different from NGS time_to_throw)
  'is_qb_hit', // QB hit/knockdown (also set by import-charted-plays-from-csv)
  'is_qb_hurry', // QB hurried
  'incomplete_pass_type', // Type of incompletion

  // Advanced Contact Metrics
  'yards_after_any_contact', // Yards after any contact (also set by import-charted-plays-from-csv)
  'broken_tackles_rec', // Broken tackles on receptions
  'broken_tackles_rush', // Broken tackles on rushes

  // Special Teams
  'punt_hang_time', // Punt hang time in seconds
  'is_punt_inside_20', // Punt downed inside 20
  'is_punt_touchback', // Punt touchback
  'is_kickoff_onside', // Onside kick attempt
  'is_kickoff_touchback', // Kickoff touchback
  'fg_result_detail', // Detailed FG miss reason

  // Defensive Player Tracking
  'sack_1_sportradar_player_id',
  'sack_2_sportradar_player_id',
  'tackle_for_loss_1_sportradar_player_id',
  'tackle_for_loss_2_sportradar_player_id',
  'fumble_forced_1_sportradar_player_id',
  'fumble_recovered_1_sportradar_player_id',
  'fumble_recovered_team',

  // Penalty Details
  // Note: penalty_type is NOT exclusive - nflfastr extracts from play descriptions
  // which is more accurate than Sportradar's API (see sportradar errors on special teams)
  'is_penalty_declined', // Penalty was declined
  'is_penalty_offset', // Offsetting penalty
  'penalty_sportradar_player_id',
  'play_direction', // Play direction from pass details

  // Kicker/Returner IDs
  'kicker_sportradar_player_id',
  'punter_sportradar_player_id',
  'returner_sportradar_player_id',

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
