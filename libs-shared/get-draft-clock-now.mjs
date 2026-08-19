import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { DRAFT_TIMEZONE } from './draft-daily-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * The clock every rookie-draft surface reads.
 *
 * While a league is paused this is the pause instant rather than the wall
 * clock, which is what freezes the draft page: a countdown, a relative window
 * time and a draft-complete check all measure against this one value, so
 * pinning it here freezes all of them together instead of leaving each surface
 * to remember the pause on its own.
 *
 * `getDraftWindow`'s `until` takes the same value, so the credited window and
 * the clock reading it stop at the same instant. Passing the wall clock there
 * while freezing the display would make a paused team's remaining time GROW,
 * since an open pause is credited up to `until`.
 *
 * Returned in the draft timezone, because callers compare its hour of day
 * against the daily window band.
 *
 * @param {object} args
 * @param {Date|string} [args.paused_at] - When the league's open pause began.
 * @param {import('dayjs').Dayjs} args.now - The caller's wall clock, already in
 *   the draft timezone.
 * @returns {import('dayjs').Dayjs}
 */
export default function get_draft_clock_now({ paused_at, now }) {
  if (!paused_at) return now

  return dayjs(paused_at).tz(DRAFT_TIMEZONE)
}
