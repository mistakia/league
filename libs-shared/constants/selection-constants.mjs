/**
 * Canonical selection values for standard selection ID format
 *
 * These constants define the valid values for selection-related fields
 * in the standard selection ID format.
 */

/**
 * Valid selection types for SEL: field
 * Used in over/under and yes/no markets
 */
export const selection_values = {
  OVER: 'OVER',
  UNDER: 'UNDER',
  YES: 'YES',
  NO: 'NO'
}

/**
 * Valid season types for SEAS_TYPE: field
 * Matches nfl_games.seas_type column values
 */
export const season_type_values = {
  REG: 'REG', // Regular season
  POST: 'POST', // Postseason/Playoffs
  PRE: 'PRE' // Preseason
}

/**
 * Valid day values for DAY: field
 * Matches nfl_games.day column values
 */
export const day_values = {
  // Regular game days
  SUN: 'SUN', // Sunday early games
  SN: 'SN', // Sunday Night
  MN: 'MN', // Monday Night
  THU: 'THU', // Thursday
  SAT: 'SAT', // Saturday
  FRI: 'FRI', // Friday
  WED: 'WED', // Wednesday

  // Playoff rounds
  WC: 'WC', // Wild Card
  DIV: 'DIV', // Divisional
  CONF: 'CONF', // Conference Championship
  SB: 'SB', // Super Bowl

  // Special
  PRE: 'PRE' // Preseason
}

/**
 * All valid selection types as an array
 */
export const valid_selection_types = Object.values(selection_values)

/**
 * All valid season types as an array
 */
export const valid_season_types = Object.values(season_type_values)

/**
 * All valid day values as an array
 */
export const valid_day_values = Object.values(day_values)
