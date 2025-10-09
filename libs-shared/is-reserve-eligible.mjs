import * as constants from './constants.mjs'
import get_final_practice_day from './get-final-practice-day.mjs'

export default function isReserveEligible({
  nfl_status,
  injury_status,
  prior_week_inactive = false,
  week = null,
  is_regular_season = false,
  game_day = null
} = {}) {
  // Apply historical grace period logic for regular season after week 1
  // Player was inactive if they have no gamelog OR gamelog.active is false
  if (week && week > 1 && is_regular_season && prior_week_inactive === true) {
    const final_practice_day = get_final_practice_day({ game_day })

    if (final_practice_day !== null) {
      const current_day_of_week = new Date().getDay()

      // Before final practice day: player remains eligible (grace period)
      if (current_day_of_week < final_practice_day) {
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
