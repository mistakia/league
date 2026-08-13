/**
 * The rookie draft's timezone and daily-window primitives.
 *
 * These live in their own module because two independent calculators need to
 * agree on them exactly: `getDraftWindow`, which places a pick's window on an
 * open hour, and `get_paused_open_seconds`, which counts how much of a league
 * pause fell inside those same open hours. `getDraftWindow` consumes the credit
 * the second one produces, so the dependency runs one way and the shared
 * definitions cannot live in either.
 *
 * A credit counted against a different band than the windows land in would be
 * wrong in silence — no error, just a pick clock off by however much the two
 * bands disagreed.
 */

export const DRAFT_TIMEZONE = 'America/New_York'

export const FIRST_HOUR_OF_DAY = 0
export const HOURS_PER_DAY = 24

export const DEFAULT_DAILY_WINDOW_START_HOUR = 11
export const DEFAULT_DAILY_WINDOW_END_HOUR = 16

/**
 * Whether `hour` falls inside the half-open interval `[start_hour, end_hour)`.
 *
 * @param {number} hour
 * @param {{start_hour: number, end_hour: number}} window
 * @returns {boolean}
 */
export const is_open_hour = (hour, { start_hour, end_hour }) =>
  hour >= start_hour && hour < end_hour

/**
 * Coerces the daily window to a usable half-open hour interval.
 *
 * `end_hour` is exclusive, so `[0, 24)` means every hour is open and
 * `[9, 22)` opens thirteen slots a day (09:00 through 21:00). An empty or
 * inverted interval would leave no hour to advance to, so it is widened to the
 * whole day rather than left to strand the caller.
 *
 * @param {Object} args
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @param {boolean} [args.warn=false] - Log when falling back. `getDraftWindow`
 *   warns because a misconfigured band silently widens every window; the credit
 *   counter stays quiet, since it would otherwise duplicate that warning on
 *   every call for the same league.
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
