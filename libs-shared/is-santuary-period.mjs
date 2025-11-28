import { current_season } from '#constants'
import get_free_agent_period from './get-free-agent-period.mjs'

export default function isSantuaryPeriod(league) {
  // If there is no extension date or its before, then it is santuary period
  if (!league.ext_date) {
    return true
  } else if (current_season.now.isBefore(league.ext_date)) {
    return true
  }

  if (league.free_agency_live_auction_start) {
    const faPeriod = get_free_agent_period(league)
    if (current_season.now.isBetween(faPeriod.start, faPeriod.end)) {
      return true
    }
  }

  const regularSeasonStart = current_season.regular_season_start.add(
    '1',
    'week'
  )
  const santuaryEnd = regularSeasonStart.add('1', 'day')
  if (current_season.now.isBetween(regularSeasonStart, santuaryEnd)) {
    return true
  }

  return false
}
