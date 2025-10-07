import dayjs from 'dayjs'

/**
 * Determines if poaching claim processing should be blocked at the current time.
 * During the regular season, claims are blocked from being processed between:
 * - Saturday 6pm EST onwards
 * - All day Sunday
 * - All day Monday
 * - Tuesday before 3pm EST
 *
 * Claims can be processed:
 * - Tuesday 3pm EST onwards through Saturday 6pm EST
 *
 * @param {dayjs.Dayjs} [now] - Optional current time (defaults to dayjs())
 * @returns {boolean} - True if processing should be blocked, false if processing is allowed
 */
export default function should_block_poach_processing(now = dayjs()) {
  const day = now.day()
  const hour = now.hour()

  // Determine if we're currently inside a blocking window
  const in_window =
    (day === 6 && hour >= 18) || // Saturday 6pm onwards
    day === 0 || // Sunday (all day)
    day === 1 || // Monday (all day)
    (day === 2 && hour < 15) // Tuesday before 3pm

  return in_window
}
