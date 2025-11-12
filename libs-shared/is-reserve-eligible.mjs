import * as constants from './constants.mjs'
import get_final_practice_day from './get-final-practice-day.mjs'
import get_most_recent_practice_status from './get-most-recent-practice-status.mjs'

/**
 * Determines if a final practice report exists
 *
 * @param {Object} params - The parameters object
 * @param {Object|null} params.practice - Practice object with day fields and status fields
 * @param {string|null} params.game_day - Game day string (e.g., "SUN", "MN", "THU")
 * @param {Date} params.current_date - The current date
 * @returns {boolean} True if final practice report exists, false otherwise
 */
function has_final_practice_report({ practice, game_day, current_date }) {
  if (!practice) {
    return false
  }

  // Check if official report exists (status or formatted_status field is set)
  if (practice.status || practice.formatted_status) {
    return true
  }

  // Map day numbers (0=Sunday, 6=Saturday) to practice object properties
  const practice_day_map = {
    0: 'su', // Sunday
    1: 'm', // Monday
    2: 'tu', // Tuesday
    3: 'w', // Wednesday
    4: 'th', // Thursday
    5: 'f', // Friday
    6: 's' // Saturday
  }

  const final_practice_day = get_final_practice_day({ game_day })
  if (final_practice_day === null) {
    return false
  }

  const current_day_of_week = current_date.getDay()

  // Sundays (0) and Mondays (1) are considered after the final practice day
  // since the new NFL week starts on Tuesday
  if (current_day_of_week === 0 || current_day_of_week === 1) {
    return true
  }

  // Check if current day is past final practice day
  if (current_day_of_week > final_practice_day) {
    return true
  }

  // Check if final practice day has a status value
  const final_day_key = practice_day_map[final_practice_day]
  if (
    practice[final_day_key] !== null &&
    practice[final_day_key] !== undefined
  ) {
    return true
  }

  return false
}

export default function isReserveEligible({
  nfl_status,
  injury_status,
  prior_week_inactive = false,
  prior_week_ruled_out = false,
  week = null,
  is_regular_season = false,
  game_day = null,
  practice = null,
  current_date = new Date()
} = {}) {
  // Check practice status first - DNP or LP makes player immediately eligible
  // Only check practice status before final practice report exists
  if (
    practice &&
    !has_final_practice_report({ practice, game_day, current_date })
  ) {
    const most_recent_practice_status = get_most_recent_practice_status({
      practice,
      current_date
    })

    if (
      most_recent_practice_status === 'DNP' ||
      most_recent_practice_status === 'LP'
    ) {
      return true
    }
  }

  // Apply historical grace period logic for regular season after week 1
  // Player was inactive if they have no gamelog OR gamelog.active is false
  // OR if they were ruled out during the game (left early due to injury)
  if (
    week &&
    week > 1 &&
    is_regular_season &&
    (prior_week_inactive === true || prior_week_ruled_out === true)
  ) {
    const final_practice_day = get_final_practice_day({ game_day })

    if (final_practice_day !== null) {
      const current_day_of_week = current_date.getDay()

      // Sundays (0) and Mondays (1) are considered after the final practice day
      // since the new NFL week starts on Tuesday, so grace period doesn't apply
      if (current_day_of_week === 0 || current_day_of_week === 1) {
        // On or after final practice day: fall through to original eligibility logic
      } else if (current_day_of_week < final_practice_day) {
        // Before final practice day: player remains eligible (grace period)
        return true
      }

      // On or after final practice day: fall through to original eligibility logic
    }
  }

  // Original eligibility logic (backward compatible)
  return Boolean(
    (nfl_status && nfl_status !== constants.player_nfl_status.ACTIVE) ||
      injury_status === constants.player_nfl_injury_status.OUT ||
      injury_status === constants.player_nfl_injury_status.DOUBTFUL ||
      (injury_status && constants.season.week === 0)
  )
}
