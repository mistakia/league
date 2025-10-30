import { constants, isReserveEligible, isReserveCovEligible } from './index.mjs'

export default function get_reserve_eligibility_from_player_map({
  player_map
}) {
  const result = {
    reserve_short_term_eligible: false,
    cov: false
  }

  if (!player_map) return result

  const nfl_status = player_map.get('nfl_status')
  const injury_status = player_map.get('injury_status')
  const prior_week_inactive = player_map.get('prior_week_inactive')
  const game_day = player_map.get('game_day')
  const practice_week = player_map.get('practice_week')
  const practice = practice_week ? practice_week.toJS() : null

  if (
    isReserveEligible({
      nfl_status,
      injury_status,
      prior_week_inactive,
      week: constants.season.week,
      is_regular_season: constants.season.isRegularSeason,
      game_day,
      practice
    })
  ) {
    result.reserve_short_term_eligible = true
  }

  if (isReserveCovEligible({ nfl_status })) {
    result.cov = true
  }

  return result
}
