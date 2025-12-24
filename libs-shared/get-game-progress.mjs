/**
 * Calculate game progress as a percentage (0-1) based on quarter and game clock.
 *
 * @param {Object} params
 * @param {number} params.quarter - Current quarter (1-5, where 5 is overtime)
 * @param {string} params.game_clock - Game clock in MM:SS format (e.g., "12:30")
 * @param {boolean} [params.is_final=false] - Whether the game has ended
 * @returns {number} Progress percentage between 0 and 1
 */
const get_game_progress = ({ quarter, game_clock, is_final = false }) => {
  // Final games are 100% complete
  if (is_final) {
    return 1
  }

  // If no quarter data, game hasn't started
  if (!quarter || quarter < 1) {
    return 0
  }

  // Overtime is treated as 100% for projection purposes
  // (use only accumulated stats, no remaining projection)
  if (quarter >= 5) {
    return 1
  }

  // Parse game clock (MM:SS format)
  let time_remaining_seconds = 0
  if (game_clock && typeof game_clock === 'string') {
    const parts = game_clock.trim().split(':')
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10)
      const seconds = parseInt(parts[1], 10)
      if (!isNaN(minutes) && !isNaN(seconds)) {
        time_remaining_seconds = minutes * 60 + seconds
      }
    }
  }

  // Each quarter is 15 minutes (900 seconds)
  const seconds_per_quarter = 900

  // Calculate completed quarters (0-3)
  const completed_quarters = quarter - 1

  // Calculate elapsed time in current quarter
  const elapsed_in_quarter = seconds_per_quarter - time_remaining_seconds

  // Total elapsed time
  const total_elapsed =
    completed_quarters * seconds_per_quarter + elapsed_in_quarter

  // Total game time (4 quarters)
  const total_game_time = 4 * seconds_per_quarter

  // Calculate progress (0-1)
  const progress = total_elapsed / total_game_time

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, progress))
}

export default get_game_progress
