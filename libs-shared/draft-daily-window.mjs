/**
 * The rookie draft's timezone and daily-band primitives.
 *
 * The band is the input to the whole published slate: its opening hour and the
 * interval derive the day's slot times, and its CLOSE is the publication
 * boundary at which the schedule is republished. `getDraftWindow` and
 * `getDraftDates` both need the timezone, and the band has to be coerced the
 * same way wherever it is read, so the definitions live here rather than in
 * either calculator.
 */

export const DRAFT_TIMEZONE = 'America/New_York'

export const FIRST_HOUR_OF_DAY = 0
export const HOURS_PER_DAY = 24

export const DEFAULT_DAILY_WINDOW_START_HOUR = 11
export const DEFAULT_DAILY_WINDOW_END_HOUR = 16

/**
 * Coerces the daily band to a usable half-open hour interval.
 *
 * `end_hour` is exclusive, so `[0, 24)` is the whole day and `[11, 24)` is the
 * elected 2026 band, closing at midnight Eastern. An empty or inverted interval
 * would derive no slots at all, so it is widened to the whole day rather than
 * left to strand the caller with a board nobody can ever be passed on.
 *
 * @param {object} args
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @param {boolean} [args.warn=false] - Log when falling back. `getDraftWindow`
 *   warns because a misconfigured band silently changes every placement on the
 *   board; readers that only need the timezone stay quiet.
 * @returns {{start_hour: number, end_hour: number}}
 */
export function resolve_daily_window({
  daily_window_start_hour,
  daily_window_end_hour,
  warn = false
}) {
  const start_hour = daily_window_start_hour ?? DEFAULT_DAILY_WINDOW_START_HOUR
  const end_hour = daily_window_end_hour ?? DEFAULT_DAILY_WINDOW_END_HOUR

  const is_usable =
    Number.isInteger(start_hour) &&
    Number.isInteger(end_hour) &&
    start_hour >= FIRST_HOUR_OF_DAY &&
    end_hour <= HOURS_PER_DAY &&
    start_hour < end_hour

  if (!is_usable) {
    if (warn) {
      console.warn(
        '[getDraftWindow] Invalid daily window:',
        { daily_window_start_hour, daily_window_end_hour },
        `- falling back to [${FIRST_HOUR_OF_DAY}, ${HOURS_PER_DAY})`
      )
    }
    return { start_hour: FIRST_HOUR_OF_DAY, end_hour: HOURS_PER_DAY }
  }

  return { start_hour, end_hour }
}

/**
 * Whether an hour of the day falls inside the band `[start_hour, end_hour)`.
 *
 * The band is half-open, so an `end_hour` of 24 admits 23 and excludes the
 * midnight that closes it — which is what makes the close a boundary rather
 * than a slot.
 *
 * @param {number} hour
 * @param {{start_hour: number, end_hour: number}} band
 * @returns {boolean}
 */
export const is_open_hour = (hour, band) =>
  hour >= band.start_hour && hour < band.end_hour
