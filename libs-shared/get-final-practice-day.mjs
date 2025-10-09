/**
 * Determines the final practice day of the week based on game day
 *
 * @param {Object} options
 * @param {string|null} options.game_day - Game day string from nfl_games.day (e.g., "THU", "SUN", "MN")
 * @returns {number|null} Day of week number (0=Sunday, 1=Monday, ..., 6=Saturday) or null if unavailable
 */
export default function get_final_practice_day({ game_day } = {}) {
  if (!game_day) {
    // Default to Friday for missing game day
    return 5
  }

  // Map game day to final practice day (day before game, accounting for practice schedules)
  switch (game_day) {
    case 'THU': // Thursday game
      return 3 // Wednesday final practice

    case 'FRI': // Friday game
      return 4 // Thursday final practice

    case 'SAT': // Saturday game
      return 5 // Friday final practice

    case 'SUN': // Sunday game
    case 'SN': // Sunday night game
      return 5 // Friday final practice

    case 'MN': // Monday night game
      return 6 // Saturday final practice

    case 'TUE': // Tuesday game (rare, covid makeup games)
      return 1 // Monday final practice

    case 'WED': // Wednesday game (very rare)
      return 2 // Tuesday final practice

    default:
      // Unknown game day, default to Friday
      return 5
  }
}
