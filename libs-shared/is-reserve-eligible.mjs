import {
  player_nfl_status,
  player_nfl_injury_status,
  current_season
} from '#constants'
import get_final_practice_day from './get-final-practice-day.mjs'
import get_most_recent_practice_status from './get-most-recent-practice-status.mjs'

/**
 * Determines if a final practice report exists
 *
 * @param {object} params - The parameters object
 * @param {object|null} params.practice - Practice object with day fields and status fields
 * @param {string|null} params.game_day - Game day string (e.g., "SUN", "MN", "THU")
 * @param {Date} params.current_date - The current date
 * @returns {boolean} True if final practice report exists, false otherwise
 */
function has_final_practice_report({ practice, game_day, current_date }) {
  if (!practice) {
    return false
  }

  // Check if official report exists (source_status or game_designation field is set)
  if (practice.source_status || practice.game_designation) {
    return true
  }

  // Map day numbers (0=Sunday, 6=Saturday) to practice object properties
  const practice_day_map = {
    0: 'sunday_practice_status', // Sunday
    1: 'monday_practice_status', // Monday
    2: 'tuesday_practice_status', // Tuesday
    3: 'wednesday_practice_status', // Wednesday
    4: 'thursday_practice_status', // Thursday
    5: 'friday_practice_status', // Friday
    6: 'saturday_practice_status' // Saturday
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
  roster_status,
  game_designation,
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
  //
  // The last clause is the OFFSEASON ALLOWANCE and it is deliberate: outside
  // the regular season ANY game_designation makes a player reserve-eligible,
  // because there is no game for them to be active for. `current_season.week`
  // reads 0 for the entire offseason, which is the switch.
  //
  // The consequence that reads as a bug and is not one: QUESTIONABLE returns
  // true today and false once Week 1 starts. In-season only OUT and DOUBTFUL
  // qualify, so no QUESTIONABLE player can reach injured reserve during the
  // season -- `submit-reserve.mjs` passes the live `current_season.week` to
  // this function. Confirmed 2026-08-03 by evaluating both phases directly.
  //
  // This clause predates the libs-shared rename. Anything asserting on
  // QUESTIONABLE must pin the clock; a single hardcoded expectation is wrong
  // for half the year. See the paired cases in
  // test/libs-shared/is-reserve-eligible.spec.mjs.
  return Boolean(
    (roster_status && roster_status !== player_nfl_status.ACTIVE) ||
    game_designation === player_nfl_injury_status.OUT ||
    game_designation === player_nfl_injury_status.DOUBTFUL ||
    (game_designation && current_season.week === 0)
  )
}
