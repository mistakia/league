import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import {
  DRAFT_TIMEZONE,
  HOURS_PER_DAY,
  resolve_daily_window
} from '../draft-daily-window.mjs'
import {
  DATE_FORMAT,
  add_days,
  instant_at,
  next_date_after
} from './slot-grid.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * The instants at which the slate is published.
 *
 * A publication is the band's CLOSE — for an 11:00-24:00 band that is midnight
 * Eastern — plus the draft opening, which is the first one. The schedule is
 * recomputed at each and is frozen between two.
 *
 * A resume voids every standing publication, and the first close at or after
 * it is the initial publication: it governs immediately, so the lead-up
 * between the resume and that close has a board rather than a void, and it
 * becomes the ordinary close when it arrives.
 */

/**
 * The band's close for the draft day starting on `date`.
 *
 * A close at hour 24 is midnight of the FOLLOWING date — the same instant,
 * named the way `instant_at` can build it, since there is no hour 24 to
 * construct.
 */
export const band_close_at = (date, band) =>
  band.end_hour < HOURS_PER_DAY
    ? instant_at(date, band.end_hour)
    : instant_at(next_date_after(date), band.end_hour % HOURS_PER_DAY)

const resolve_now = (until) =>
  until ? dayjs(until).tz(DRAFT_TIMEZONE) : dayjs().tz(DRAFT_TIMEZONE)

/**
 * Every publication governing `until`, in order, oldest first.
 *
 * This is the whole input to the window rule: a pick's window is the earliest
 * slot any of these publications ever gave it, so the rule needs the sequence
 * rather than only the latest one.
 *
 * The resume comparison is `>=`, not `>`. A boundary is usable when it lands
 * at or after the latest resume — but one landing exactly ON the resume second
 * does publish. Under a strict `>` a one-second coincidence would black out a
 * further whole day for no reason anybody could explain to a manager.
 *
 * @param {object} args
 * @param {number} args.draft_start_timestamp - Unix seconds the draft opens.
 * @param {{start_hour: number, end_hour: number}} args.band
 * @param {Date|string} [args.resumed_at] - The league's LATEST resume.
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's now.
 * @returns {import('dayjs').Dayjs[]} Empty only before the draft opens. A
 *   resumed league's first close at or after the resume is its initial
 *   publication, so the lead-up always carries a board.
 */
export function list_publication_boundaries({
  draft_start_timestamp,
  band,
  resumed_at,
  until
}) {
  const now = resolve_now(until)
  const draft_start = dayjs.unix(draft_start_timestamp).tz(DRAFT_TIMEZONE)

  // The draft has not opened, so there is nothing to publish.
  if (now.isBefore(draft_start)) return []

  const resume = resumed_at ? dayjs(resumed_at).tz(DRAFT_TIMEZONE) : null
  const is_resumed = Boolean(resume && resume.isAfter(draft_start))

  const boundaries = []
  // The draft opening publishes the first slate, unless a pause has since
  // voided it, in which case the first close at or after the resume does.
  const floor = is_resumed ? resume : draft_start
  if (!is_resumed) boundaries.push(draft_start)

  // Walk the daily closes by DATE rather than by adding a day to the previous
  // close: a close at hour 24 belongs to the date before the instant it lands
  // on, so deriving the next date from the instant would skip one. The walk
  // opens a day EARLY for the same reason — a midnight close carries the prior
  // date, so starting on the floor's own date would step over a close landing
  // exactly on the resume.
  let date = add_days(floor.format(DATE_FORMAT), -1)
  let close = band_close_at(date, band)
  while (is_resumed ? close.isBefore(floor) : !close.isAfter(floor)) {
    date = next_date_after(date)
    close = band_close_at(date, band)
  }

  // The first close at or after the resume is the initial publication: it
  // governs immediately, so the lead-up between the resume and that close has
  // a board rather than a void. Once the close arrives the loop below pushes
  // it again (same instant, so the re-laid slate is unchanged).
  if (is_resumed && close.isAfter(now)) {
    boundaries.push(close)
  }

  while (!close.isAfter(now)) {
    boundaries.push(close)
    date = next_date_after(date)
    close = band_close_at(date, band)
  }

  return boundaries
}

/**
 * The publication boundary governing `until`, or null when none does.
 *
 * The latest publication — what the board is laid out from today. Null only
 * before the draft opens; a resumed league's first close at or after the
 * resume is its initial publication, so the lead-up between the resume and
 * that close is already governed by it.
 *
 * @param {object} args
 * @param {number} args.draft_start_timestamp - Unix seconds the draft opens.
 * @param {Date|string} [args.resumed_at] - The league's LATEST resume, timestamptz.
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's now.
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @returns {import('dayjs').Dayjs|null}
 */
export function get_publication_boundary({
  draft_start_timestamp,
  resumed_at,
  until,
  daily_window_start_hour,
  daily_window_end_hour
} = {}) {
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour,
    warn: true
  })

  const boundaries = list_publication_boundaries({
    draft_start_timestamp,
    band,
    resumed_at,
    until
  })

  return boundaries.length ? boundaries[boundaries.length - 1] : null
}

/**
 * The next publication boundary strictly AFTER `until`.
 *
 * The counterpart to `get_publication_boundary`, and the only thing a surface
 * can honestly say while every window is null: no pick has a slot yet, and the
 * next slate is published at this instant. Strictly after, because a boundary
 * landing exactly on now has already published.
 *
 * @param {object} args
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's now.
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @returns {import('dayjs').Dayjs}
 */
export function get_next_publication_boundary({
  until,
  daily_window_start_hour,
  daily_window_end_hour
} = {}) {
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour,
    warn: true
  })

  const now = resolve_now(until)
  const close = band_close_at(now.format(DATE_FORMAT), band)

  return close.isAfter(now)
    ? close
    : band_close_at(next_date_after(now.format(DATE_FORMAT)), band)
}
