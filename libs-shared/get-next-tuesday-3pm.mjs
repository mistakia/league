import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Calculates the next Tuesday at 3pm EST based on the current time.
 *
 * If current time is before Tuesday 3pm this week, returns this Tuesday 3pm.
 * If current time is at or after Tuesday 3pm this week, returns next Tuesday 3pm.
 *
 * @param {dayjs.Dayjs} [now] - Optional current time (defaults to dayjs())
 * @returns {dayjs.Dayjs} - The next Tuesday at 3pm EST
 */
export default function get_next_tuesday_3pm(now = dayjs()) {
  const now_est = dayjs(now).tz('America/New_York')

  const this_tuesday_3pm = now_est.day(2).startOf('day').hour(15)

  const is_before_tuesday_cutoff = now_est.isBefore(this_tuesday_3pm)

  if (is_before_tuesday_cutoff) {
    return this_tuesday_3pm
  } else {
    return this_tuesday_3pm.add('1', 'week')
  }
}
