import { isReserveEligible, isReserveCovEligible } from './index.mjs'
import { current_season } from '#constants'

export default function get_reserve_eligibility_from_player_map({
  player_map
}) {
  const result = {
    reserve_short_term_eligible: false,
    cov: false
  }

  if (!player_map) return result

  const roster_status = player_map.get('roster_status')
  const game_designation = player_map.get('game_designation')
  const prior_week_inactive = player_map.get('prior_week_inactive')
  const prior_week_ruled_out = player_map.get('prior_week_ruled_out')
  const game_day = player_map.get('game_day')
  const practice_week = player_map.get('practice_week')
  const practice = practice_week ? practice_week.toJS() : null

  if (
    isReserveEligible({
      roster_status,
      game_designation,
      prior_week_inactive,
      prior_week_ruled_out,
      week: current_season.week,
      is_regular_season: current_season.isRegularSeason,
      game_day,
      practice
    })
  ) {
    result.reserve_short_term_eligible = true
  }

  if (isReserveCovEligible({ roster_status })) {
    result.cov = true
  }

  return result
}
