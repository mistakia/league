import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { DRAFT_TIMEZONE } from '../draft-daily-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

export const DEFAULT_PICK_INTERVAL_HOURS = 1

export const DATE_FORMAT = 'YYYY-MM-DD'

/**
 * The slot grid: the fixed set of wall-clock hours a window may fall on, and
 * the indexing that turns a position in a queue into an instant.
 *
 * The grid is the same every day — an 11:00-24:00 band at a 3-hour interval
 * seats five slots at 11, 14, 17, 20 and 23, on that day and on every day
 * after it. Nothing carries over the overnight gap, so the slot times cannot
 * drift, which is what makes the published times something a manager can hold
 * in their head.
 *
 * The last slot of a day is not a short one. A window is the moment a pick
 * becomes passable, not an interval that expires — once open it stays open —
 * so the 23:00 slot on a band closing at midnight gives that pick the clock to
 * itself until 11:00 the next morning, which is longer than any other slot,
 * not shorter. The band close only stops a NEW pick joining.
 */

/**
 * A timezone-aware instant built fresh from a `(date, hour)` pair.
 *
 * Every slot and every boundary is constructed this way rather than by adding
 * hours to a previous instant. Hour arithmetic across a DST transition drifts
 * by the offset change — 24 hours after midnight on a spring-forward date is
 * 01:00, not midnight — so a schedule built by accumulation walks off the
 * wall-clock hours it is supposed to publish. Building from the pair pins each
 * slot to its wall-clock hour on its own date, which is what the notice says.
 *
 * The one residual is a slot hour that does not EXIST on a spring-forward
 * date; dayjs resolves it forward to 03:00. No elected band puts a slot there,
 * and pinning the behavior is tracked on
 * `user:task/league/fix-draft-window-dst-offset-latching.md`.
 */
export const instant_at = (date, hour) =>
  dayjs.tz(`${date} ${String(hour).padStart(2, '0')}:00:00`, DRAFT_TIMEZONE)

/**
 * The calendar date `days` after `date`.
 *
 * Resolved at NOON so the addition cannot land on an hour that a DST
 * transition removes or repeats; only the date is read off the result.
 */
export const add_days = (date, days) =>
  days === 0
    ? date
    : dayjs
        .tz(`${date} 12:00:00`, DRAFT_TIMEZONE)
        .add(days, 'day')
        .format(DATE_FORMAT)

export const next_date_after = (date) => add_days(date, 1)

/**
 * Validates the interval, falling back to the default rather than silently
 * accepting a value that would produce an empty or infinite slot list.
 */
export function resolve_pick_interval_hours(pick_interval_hours) {
  const interval = pick_interval_hours ?? DEFAULT_PICK_INTERVAL_HOURS

  if (!Number.isInteger(interval) || interval < 1) {
    console.warn(
      '[getDraftWindow] Invalid pick_interval_hours:',
      pick_interval_hours,
      `- falling back to ${DEFAULT_PICK_INTERVAL_HOURS}`
    )
    return DEFAULT_PICK_INTERVAL_HOURS
  }

  return interval
}

/**
 * The day's slot hours, in order.
 *
 * Counted from the band's opening hour at the interval, stopping at the close,
 * which is exclusive — so `[11, 24)` at 3 hours is `[11, 14, 17, 20, 23]` and
 * the midnight close is a boundary rather than a slot. An interval at least as
 * wide as the band yields the opening hour alone, which is the constitutional
 * once-a-day cadence.
 *
 * Always at least one hour, since `resolve_daily_window` guarantees
 * `start_hour < end_hour`.
 *
 * @param {Object} args
 * @param {{start_hour: number, end_hour: number}} args.band
 * @param {number} args.interval - Hours between slots.
 * @returns {number[]}
 */
export function resolve_slot_hours({ band, interval }) {
  const slot_hours = []

  for (let hour = band.start_hour; hour < band.end_hour; hour += interval) {
    slot_hours.push(hour)
  }

  return slot_hours
}

/**
 * The `index`-th slot at or after `from`.
 *
 * Index 0 is the first slot the grid offers at or after `from` — the same
 * instant when `from` lands exactly on a slot hour, and the next one up
 * otherwise. Each further index is one slot later, rolling onto the next day
 * once the day's slots are spent.
 *
 * @param {Object} args
 * @param {import('dayjs').Dayjs} args.from - The instant to seat the queue from.
 * @param {number} args.index - Position in the queue, 0-based.
 * @param {{start_hour: number, end_hour: number}} args.band
 * @param {number} args.interval - Hours between slots.
 * @returns {import('dayjs').Dayjs}
 */
export function slot_at_index({ from, index, band, interval }) {
  const slot_hours = resolve_slot_hours({ band, interval })

  // A defensive clamp on the caller's arithmetic rather than a domain case: a
  // negative position would index backwards off the grid and place a window
  // silently early, which is the one failure a passability check cannot survive.
  const queue_position = Number.isInteger(index) && index > 0 ? index : 0
  if (queue_position !== index) {
    console.warn('[getDraftWindow] Invalid slot index:', index, '- using 0')
  }

  let date = from.format(DATE_FORMAT)
  let first_slot = slot_hours.findIndex(
    (hour) => !instant_at(date, hour).isBefore(from)
  )

  // Every slot on this date is behind `from`, so the queue opens tomorrow.
  if (first_slot === -1) {
    date = next_date_after(date)
    first_slot = 0
  }

  const position = first_slot + queue_position

  return instant_at(
    add_days(date, Math.floor(position / slot_hours.length)),
    slot_hours[position % slot_hours.length]
  )
}
