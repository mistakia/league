import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { DRAFT_TIMEZONE, resolve_daily_window } from './draft-daily-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Counts how many OPEN seconds of a league pause fall inside a bounded span.
 *
 * The rookie draft clock advances only through hours inside the daily window
 * `[daily_window_start_hour, daily_window_end_hour)`, so a pause is only worth
 * crediting for the part of it that overlaps those hours. A pause that runs
 * entirely overnight costs the draft nothing and credits nothing.
 *
 * Both bounds are ARGUMENTS rather than columns, and that is the whole
 * correctness argument for this module.
 *
 * `from` is the window's RESOLVED REFERENCE — mid-draft, the selection
 * timestamp of the last pick made before the one being placed. Pause time
 * before that instant has already been absorbed: the team that made that pick
 * was not waiting during it, so crediting it would push every subsequent pick
 * later by the whole pause. That error does not merely repeat per pick, it
 * compounds, because each over-late window delays the selection that becomes
 * the next pick's anchor. A single scalar measured from `draft_start` cannot
 * express this bound, which is why the caller passes intervals and this
 * function does the clip.
 *
 * `until` is the caller's now. `league_pauses` has no `until` column and an
 * open pause is one whose `resumed_at` is null, so an unresolved pause is
 * closed against the caller's clock here rather than being filled in at the
 * source. That is what lets a live pause be measured continuously: as now
 * advances through a pause, the credit grows at exactly the same rate, so the
 * remaining time on a pick's clock holds still instead of ticking down.
 *
 * Seconds, not hours. Routing the credit through an hour-granular walker
 * truncates the anchor's minutes, and the anchor is a real selection timestamp
 * so it essentially always has minutes — measured loss runs to 59 minutes,
 * which is a quarter of a four-hour pick clock.
 *
 * Isomorphic: the SPA measures a live pause against its own clock with this
 * same function, so a countdown cannot disagree with the server's placement.
 *
 * @param {Object} args
 * @param {Array<{paused_at: Date|string, resumed_at: Date|string|null}>} [args.draft_pause_periods]
 *   Pause intervals. `resumed_at` null means still open.
 * @param {import('dayjs').Dayjs} args.from - Lower clip bound; the resolved reference.
 * @param {import('dayjs').Dayjs} args.until - Upper clip bound; the caller's now.
 * @param {string} [args.cadence_unit='hour'] - Throws on 'day'; see below.
 * @param {number} [args.daily_window_start_hour=11] - First open hour (inclusive).
 * @param {number} [args.daily_window_end_hour=23] - Hour the window closes (EXCLUSIVE).
 *
 * @returns {number} Open seconds inside the clip. Never negative.
 *
 * @throws {Error} On a 'day' cadence. A day step holds its time of day across
 *   the step, so "open seconds" and "one step" do not measure the same thing
 *   and a seconds credit would silently mean something different than it does
 *   under an hour cadence. Live config is 'hour'; throwing keeps a day-cadence
 *   league from being credited wrongly in silence.
 */
export default function get_paused_open_seconds({
  draft_pause_periods,
  from,
  until,
  cadence_unit = 'hour',
  daily_window_start_hour,
  daily_window_end_hour
}) {
  if (cadence_unit === 'day') {
    throw new Error(
      '[get_paused_open_seconds] a day cadence cannot be credited in open seconds'
    )
  }

  const periods = draft_pause_periods ?? []
  if (!periods.length || !from || !until) return 0
  if (!until.isAfter(from)) return 0

  const window = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })

  let total_seconds = 0

  for (const period of periods) {
    const paused_at = to_draft_time(period.paused_at)
    if (!paused_at || !paused_at.isValid()) continue

    // A null `resumed_at` is an OPEN pause, which runs to the caller's clock.
    const resumed_at = period.resumed_at
      ? to_draft_time(period.resumed_at)
      : until
    if (!resumed_at || !resumed_at.isValid()) continue

    const clip_start = paused_at.isAfter(from) ? paused_at : from
    const clip_end = resumed_at.isBefore(until) ? resumed_at : until

    total_seconds += open_seconds_between({
      start: clip_start,
      end: clip_end,
      window
    })
  }

  return total_seconds
}

/**
 * Open seconds between two instants, summed a calendar day at a time.
 *
 * Walking days rather than hours is what keeps the count continuous: each day
 * contributes the overlap between `[start, end]` and that day's open band, with
 * no rounding at either edge.
 */
function open_seconds_between({ start, end, window }) {
  if (!end.isAfter(start)) return 0

  let seconds = 0
  let day = start.startOf('day')
  const last_day = end.startOf('day')

  // Bounded by the span's own length in days, so this cannot spin.
  while (!day.isAfter(last_day)) {
    const band_open = day
      .hour(window.start_hour)
      .minute(0)
      .second(0)
      .millisecond(0)
    const band_close = day
      .hour(window.end_hour)
      .minute(0)
      .second(0)
      .millisecond(0)

    const overlap_start = start.isAfter(band_open) ? start : band_open
    const overlap_end = end.isBefore(band_close) ? end : band_close

    if (overlap_end.isAfter(overlap_start)) {
      seconds += overlap_end.diff(overlap_start, 'second')
    }

    day = day.add(1, 'day').startOf('day')
  }

  return seconds
}

/**
 * Coerces a stored timestamptz to a Dayjs instant in the draft timezone.
 *
 * `league_pauses.paused_at` and `resumed_at` are timestamptz and always
 * DB-sourced, so they arrive as a `Date` on the server and an ISO string once
 * through JSON. Both are instants, which is why neither is converted from epoch
 * seconds here — the same rule `getDraftWindow` states for
 * `selection_timestamp`.
 */
function to_draft_time(value) {
  if (!value) return null
  if (dayjs.isDayjs(value)) return value.tz(DRAFT_TIMEZONE)
  return dayjs(value).tz(DRAFT_TIMEZONE)
}
