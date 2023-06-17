import { season } from './constants.mjs'
import getFreeAgentPeriod from './get-free-agent-period.mjs'

export default function isSantuaryPeriod(league) {
  // If there is no extension date or its before, then it is santuary period
  if (!league.ext_date) {
    return true
  } else if (season.now.isBefore(league.ext_date)) {
    return true
  }

  if (league.adate) {
    const faPeriod = getFreeAgentPeriod(league.adate)
    if (season.now.isBetween(faPeriod.start, faPeriod.end)) {
      return true
    }
  }

  const regularSeasonStart = season.start.add('1', 'week')
  const santuaryEnd = regularSeasonStart.add('1', 'day')
  if (season.now.isBetween(regularSeasonStart, santuaryEnd)) {
    return true
  }

  return false
}
