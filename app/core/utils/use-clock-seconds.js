import { useEffect, useState } from 'react'

/**
 * A unix-second clock that advances on its own, for anything whose display or
 * visibility depends on a deadline passing rather than on redux state changing.
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

const pad = (value) => String(value).padStart(2, '0')

/**
 * A duration in seconds as a countdown, coarsening as the deadline recedes so
 * the leading unit is always the one worth reading.
 */
export const format_countdown = (seconds) => {
  if (seconds <= 0) return '0m 00s'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining_seconds = seconds % 60

  if (days) return `${days}d ${pad(hours)}h ${pad(minutes)}m`
  if (hours) return `${hours}h ${pad(minutes)}m ${pad(remaining_seconds)}s`
  return `${minutes}m ${pad(remaining_seconds)}s`
}
