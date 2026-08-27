import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween.js'
import { current_season } from '#constants'
import get_next_tuesday_3pm from './get-next-tuesday-3pm.mjs'

dayjs.extend(isBetween)

// `submitted` is an INSTANT, not epoch seconds: `poaches.submitted` became
// timestamptz in the 2026-08-08 lifecycle retype. Both callers now agree on
// that -- submit-poach.mjs passes the Date it writes, and poach-notice.js
// passes the column as the ISO string it became over JSON, and dayjs parses
// either. The previous `dayjs.unix()` would have read a Date as epoch seconds
// and rendered a year-58,000 processing time that passes isValid().
export default function (submitted) {
  const submitted_timestamp = dayjs(submitted)
  if (current_season.is_offseason) {
    return submitted_timestamp.add('48', 'hours')
  }

  // if submitted between thursday 6pm and sunday 3pm — set to tuesday at 3pm
  const { now } = current_season
  const is_before_tuesday_cutoff = now.isBefore(
    now.day(2).startOf('day').hour(15)
  )
  const start_window = (
    is_before_tuesday_cutoff ? now.subtract('1', 'week').day(4) : now.day(4)
  )
    .startOf('day')
    .hour(18)
  const end_window = (
    is_before_tuesday_cutoff ? now.day(0) : now.add('1', 'week').day(0)
  )
    .startOf('day')
    .hour(15)

  if (submitted_timestamp.isBetween(start_window, end_window)) {
    return get_next_tuesday_3pm(now)
  } else {
    // otherwise add 48 hours
    return submitted_timestamp.add('48', 'hours')
  }
}
