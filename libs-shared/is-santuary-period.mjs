import { current_season } from '#constants'
import get_free_agent_period from './get-free-agent-period.mjs'

export default function isSantuaryPeriod(league) {
  // If there is no extension date or its before, then it is santuary period
  if (!league.extension_deadline_at) {
    return true
  } else if (current_season.now.isBefore(league.extension_deadline_at)) {
    return true
  }

  if (league.free_agency_period_start) {
    const faPeriod = get_free_agent_period(league)
    // Sanctuary period 3 (Amendment XXXV): from the start of the free agency
    // period through the conclusion of the auction. The auction now runs the
    // whole period, so its conclusion IS the period end -- no separate
    // auction-end instant, and no fallback, since the two collapsed into one.
    if (current_season.now.isBetween(faPeriod.start, faPeriod.end)) {
      return true
    }
  }

  const protectionStart = current_season.practice_squad_protection_start
  const santuaryEnd = protectionStart.add('1', 'day')
  if (current_season.now.isBetween(protectionStart, santuaryEnd)) {
    return true
  }

  return false
}
