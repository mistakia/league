import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { get_trade_veto_deadline } from '@libs-shared'

/**
 * A unix-second clock that advances on its own, for anything whose visibility
 * depends on a deadline passing rather than on redux state changing.
 */
export const useClockSeconds = (interval_ms = 30000) => {
  const [now, set_now] = useState(() => Math.round(Date.now() / 1000))

  useEffect(() => {
    const interval = setInterval(
      () => set_now(Math.round(Date.now() / 1000)),
      interval_ms
    )
    return () => clearInterval(interval)
  }, [interval_ms])

  return now
}

const format_remaining = (seconds) => {
  if (seconds < 60) return '< 1m'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

/**
 * How long a commissioner has left to veto a trade. A bare "vetoable" boolean
 * would not tell them whether to act now, and the deadline is the same one the
 * server enforces — both sides read it off `libs-shared`.
 *
 * Renders nothing once the window has closed, so a stale list stops offering an
 * action the server would refuse.
 */
export default function TradeVetoCountdown({
  trade,
  league,
  prefix = 'Vetoable for '
}) {
  const now = useClockSeconds()

  const deadline = get_trade_veto_deadline({ trade, league })
  if (!deadline || trade.vetoed || deadline <= now) {
    return null
  }

  return (
    <div className='trade__veto-countdown'>
      {prefix}
      {format_remaining(deadline - now)}
    </div>
  )
}

TradeVetoCountdown.propTypes = {
  trade: ImmutablePropTypes.record,
  league: PropTypes.object,
  prefix: PropTypes.string
}
