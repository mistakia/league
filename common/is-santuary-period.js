import { season } from './constants'
import getFreeAgentPeriod from './get-free-agent-period'

export default function isSantuaryPeriod(league) {
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
